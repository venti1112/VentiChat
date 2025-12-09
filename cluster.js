const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const configPath = path.join(__dirname, 'config', 'config.json');

// 检查配置文件是否存在，如果不存在则运行初始化脚本
// 此函数必须放在最前面，因为它不依赖于其他自定义模块
async function checkAndInitialize() {
    try {
        await fs.access(configPath);
        // 配置文件存在，正常加载
        return true;
    } catch (err) {
        // 配置文件不存在，运行初始化脚本
        console.log('配置文件不存在，正在运行初始化脚本...');
        return new Promise((resolve, reject) => {
            const initProcess = spawn('node', ['setup/setup.js'], { stdio: 'inherit' });
            
            initProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('初始化完成，继续启动应用...');
                    resolve(true);
                } else {
                    console.error(`初始化失败，退出码: ${code}`);
                    reject(false);
                }
            });
        });
    }
}

// 优雅关闭服务器
function shutdownServer() {
    log('INFO', '正在关闭服务器...');
    process.exit(1);
}

// 等待检查和可能的初始化完成后再继续
(async () => {
    try {
        await checkAndInitialize();
        
        // 只有在配置文件存在或初始化完成后才继续执行原有逻辑
        const config = require('./config/config.json');
        
        // 在确认配置文件存在后，再导入需要配置的依赖
        const { log, processIds } = require('./utils/logger');
        const startCleanupScheduler = require('./utils/cleanupScheduler');
        const { sequelize } = require('./utils/databaseClient');

        // 初始化进程编号
        if (cluster.isMaster || cluster.isPrimary) {
            processIds.set(process.pid, 0); // 为主进程分配ID 0
            
            // 初始化模型
            const models = {
                User: require('./models/user')(sequelize),
                Room: require('./models/room')(sequelize),
                RoomMember: require('./models/roomMember')(sequelize),
                Message: require('./models/message')(sequelize),
                JoinRequest: require('./models/joinRequest')(sequelize),
                SystemSetting: require('./models/systemSetting')(sequelize),
            };

            // 在主进程中启动定时清理任务
            // 创建一个模拟的app对象，因为我们只需要其中的io属性（在清理任务中用于发送通知）
            const app = { 
                get: () => null // 主进程中不需要io实例
            };
            startCleanupScheduler(models, app);

            // 确定工作进程数量
            const numCPUs = config.workerCount && config.workerCount > 0 ? config.workerCount : os.cpus().length;

            // 下一个可用的工作进程ID
            let nextWorkerId = 1;

            // 存储工作进程引用
            const workers = {};

            // 记录工作进程错误状态
            const workerErrors = {};

            // 获取下一个工作进程ID的函数
            function getNextWorkerId() {
                // 简单地返回当前最大ID+1
                const ids = Object.keys(workers).map(Number);
                return ids.length > 0 ? Math.max(...ids) + 1 : 1;
            }

            // 衍生工作进程，使用固定的ID分配策略
            for (let i = 1; i <= numCPUs; i++) {
                const worker = cluster.fork({
                    WORKER_PORT: (parseInt(config.port) + i).toString()
                });
                workers[i] = worker;
                processIds.set(worker.process.pid, i);
                
                // 监听工作进程的消息，检查是否有错误报告
                worker.on('message', (msg) => {
                    if (msg.type === 'workerError') {
                        log('ERROR', `工作进程 ${i} 报告严重错误: ${msg.error}`);
                        workerErrors[i] = true;
                        
                        // 如果是启动过程中的致命错误，关闭整个服务器
                        if (msg.fatal) {
                            log('ERROR', '检测到工作进程启动致命错误，正在关闭服务器...');
                            shutdownServer();
                        }
                    }
                });
            }
            
            // 启动负载均衡代理进程
            let proxyProcess = spawn('node', ['proxy.js'], { 
                stdio: 'inherit'
            });
            
            // 监听代理进程退出事件，实现自动重启
            proxyProcess.on('exit', (code, signal) => {
                log('WARN', `代理进程退出 (代码: ${code}, 信号: ${signal})`);
                
                // 重启代理进程
                log('INFO', '正在重启代理进程...');
                proxyProcess = spawn('node', ['proxy.js'], { 
                    stdio: 'inherit'
                });
                    
                // 重新注册事件监听器
                proxyProcess.on('error', (err) => {
                    log('ERROR', `代理进程启动失败: ${err}`);
                });
                    
                proxyProcess.on('exit', restartProxy);
            });
            
            // 定义重启函数
            const restartProxy = (code, signal) => {
                log('WARN', `代理进程退出 (代码: ${code}, 信号: ${signal})`);
                
                // 重启代理进程
                log('INFO', '正在重启代理进程...');
                proxyProcess = spawn('node', ['proxy.js'], { 
                    stdio: 'inherit'
                });
                    
                // 重新注册事件监听器
                proxyProcess.on('error', (err) => {
                    log('ERROR', `代理进程启动失败: ${err}`);
                });

                proxyProcess.on('exit', restartProxy);
            };
            
            proxyProcess.on('error', (err) => {
                log('ERROR', `代理进程启动失败: ${err}`);
            });
            
            // 处理工作进程间的消息转发
            Object.values(workers).forEach(worker => {
                worker.on('message', (msg) => {
                    log('DEBUG', `主进程收到工作进程消息: ${JSON.stringify(msg)}`);
                    
                    // 如果消息需要转发到其他工作进程
                    if (msg.type === 'forwardToWorker') {
                        const targetWorker = workers[msg.targetWorkerId];
                        if (targetWorker) {
                            // 转发消息到目标工作进程
                            targetWorker.send({
                                type: 'emitToSocket',
                                socketId: msg.socketId,
                                event: msg.event,
                                data: msg.data
                            });
                            log('DEBUG', `转发消息到工作进程 ${msg.targetWorkerId}: Socket=${msg.socketId}, 事件=${msg.event}`);
                        } else {
                            log('WARN', `目标工作进程 ${msg.targetWorkerId} 不存在`);
                        }
                    }
                });
            });
            
            cluster.on('exit', (worker, code, signal) => {
                // 查找退出的工作进程ID
                let workerId = null;
                for (const [id, w] of Object.entries(workers)) {
                    if (w.process.pid === worker.process.pid) {
                        workerId = parseInt(id);
                        break;
                    }
                }
                
                // 从workers映射中删除已退出的进程
                if (workerId !== null) {
                    delete workers[workerId];
                }
                
                // 检查是否是因为严重错误退出
                if (workerId !== null && workerErrors[workerId]) {
                    log('ERROR', `工作进程 ${workerId} 因严重错误退出 (代码: ${code}, 信号: ${signal})`);
                    log('ERROR', '由于工作进程严重错误，正在关闭服务器...');
                    shutdownServer();
                    return;
                }
                
                log('INFO', `工作进程 ${workerId !== null ? workerId : 'unknown'} 已退出 (代码: ${code}, 信号: ${signal})`);
                log('INFO', '正在启动新的工作进程...');
                
                // 先清理旧的进程ID映射
                processIds.delete(worker.process.pid);
                
                // 使用相同的ID创建工作进程
                const newWorker = cluster.fork({
                    WORKER_PORT: (parseInt(config.port) + workerId).toString()
                });
                
                // 使用相同的ID为新工作进程分配编号
                if (workerId !== null) {
                    workers[workerId] = newWorker;
                    processIds.set(newWorker.process.pid, workerId);
                }
                
                // 监听新工作进程的错误消息
                newWorker.on('message', (msg) => {
                    if (msg.type === 'workerError') {
                        log('ERROR', `工作进程 ${workerId} 报告严重错误: ${msg.error}`);
                        if (workerId !== null) {
                            workerErrors[workerId] = true;
                        }
                        
                        // 如果是启动过程中的致命错误，关闭整个服务器
                        if (msg.fatal) {
                            log('ERROR', '检测到工作进程启动致命错误，正在关闭服务器...');
                            shutdownServer();
                        }
                    }
                });
                
                // 当新工作进程开始时，重新建立消息监听
                newWorker.on('online', () => {
                    log('INFO', `新工作进程 ${workerId !== null ? workerId : 'unknown'} 已上线`);
                });
            });
        } else {
            // 工作进程代码
            require('./app.js');
            // 工作进程的日志由 app.js 内部处理
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();