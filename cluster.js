const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const configPath = path.join(__dirname, 'config', 'config.json');
const { log, LOG_LEVELS, processIds } = require('./utils/logger');

// 检查配置文件是否存在，如果不存在则运行初始化脚本
async function checkAndInitialize() {
    try {
        await fs.access(configPath);
        // 配置文件存在，正常加载
        return true;
    } catch (err) {
        // 配置文件不存在，运行初始化脚本
        log(LOG_LEVELS.INFO, '配置文件不存在，正在运行初始化脚本...');
        return new Promise((resolve, reject) => {
            const initProcess = spawn('node', ['scripts/init.js'], { stdio: 'inherit' });
            
            initProcess.on('close', (code) => {
                if (code === 0) {
                    log(LOG_LEVELS.INFO, '初始化完成，继续启动应用...');
                    resolve(true);
                } else {
                    log(LOG_LEVELS.ERROR, `初始化失败，退出码: ${code}`);
                    reject(false);
                }
            });
        });
    }
}

// 优雅关闭服务器
function shutdownServer() {
    log(LOG_LEVELS.INFO, '正在关闭服务器...');
    process.exit(1);
}

// 等待检查和可能的初始化完成后再继续
(async () => {
    try {
        await checkAndInitialize();
        
        // 只有在配置文件存在或初始化完成后才继续执行原有逻辑
        const config = require('./config/config.json');

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
            return nextWorkerId++;
        }

        // 初始化进程编号
        if (cluster.isMaster || cluster.isPrimary) {
            processIds.set(process.pid, 0); // 为主进程分配ID 0
            
            log(LOG_LEVELS.INFO, `主进程准备就绪，将创建 ${numCPUs} 个工作进程`);
            
            // 衍生工作进程，并立即分配内部编号
            for (let i = 0; i < numCPUs; i++) {
                const worker = cluster.fork({
                    WORKER_PORT: (parseInt(config.port) + i + 1).toString()  // 每个工作进程使用独立端口，确保是字符串类型
                });
                // 立即为工作进程分配内部编号
                const workerId = getNextWorkerId();
                workers[workerId] = worker;
                processIds.set(worker.process.pid, workerId);
                
                // 向工作进程发送其ID
                worker.send({ type: 'assignId', workerId: workerId });
                
                // 监听工作进程的消息，检查是否有错误报告
                worker.on('message', (msg) => {
                    if (msg.type === 'workerError') {
                        log(LOG_LEVELS.ERROR, `工作进程 ${workerId} 报告严重错误: ${msg.error}`);
                        workerErrors[workerId] = true;
                        
                        // 如果是启动过程中的致命错误，关闭整个服务器
                        if (msg.fatal) {
                            log(LOG_LEVELS.ERROR, '检测到工作进程启动致命错误，正在关闭服务器...');
                            shutdownServer();
                        }
                    }
                });
            }
            
            // 启动负载均衡代理进程
            const proxyProcess = spawn('node', ['proxy.js'], { 
                stdio: 'inherit'
            });
            
            proxyProcess.on('error', (err) => {
                log(LOG_LEVELS.ERROR, `代理进程启动失败: ${err}`);
            });
            
            // 处理工作进程间的消息转发
            Object.values(workers).forEach(worker => {
                worker.on('message', (msg) => {
                    log(LOG_LEVELS.DEBUG, `主进程收到工作进程消息: ${JSON.stringify(msg)}`);
                    
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
                            log(LOG_LEVELS.DEBUG, `转发消息到工作进程 ${msg.targetWorkerId}: Socket=${msg.socketId}, 事件=${msg.event}`);
                        } else {
                            log(LOG_LEVELS.WARN, `目标工作进程 ${msg.targetWorkerId} 不存在`);
                        }
                    }
                });
            });
            
            cluster.on('exit', (worker, code, signal) => {
                const workerId = processIds.get(worker.process.pid);
                
                // 检查是否是因为严重错误退出
                if (workerErrors[workerId]) {
                    log(LOG_LEVELS.ERROR, `工作进程 ${workerId} 因严重错误退出 (代码: ${code}, 信号: ${signal})`);
                    log(LOG_LEVELS.ERROR, '由于工作进程严重错误，正在关闭服务器...');
                    shutdownServer();
                    return;
                }
                
                log(LOG_LEVELS.INFO, `工作进程 ${workerId} 已退出 (代码: ${code}, 信号: ${signal})`);
                log(LOG_LEVELS.INFO, '正在启动新的工作进程...');
                const newWorker = cluster.fork({
                    WORKER_PORT: (parseInt(config.port) + Object.keys(workers).length + 1).toString()
                });
                const newWorkerId = getNextWorkerId();
                workers[newWorkerId] = newWorker;
                processIds.set(newWorker.process.pid, newWorkerId);
                
                // 向新工作进程发送其ID
                newWorker.send({ type: 'assignId', workerId: newWorkerId });
                
                // 监听新工作进程的错误消息
                newWorker.on('message', (msg) => {
                    if (msg.type === 'workerError') {
                        log(LOG_LEVELS.ERROR, `工作进程 ${newWorkerId} 报告严重错误: ${msg.error}`);
                        workerErrors[newWorkerId] = true;
                        
                        // 如果是启动过程中的致命错误，关闭整个服务器
                        if (msg.fatal) {
                            log(LOG_LEVELS.ERROR, '检测到工作进程启动致命错误，正在关闭服务器...');
                            shutdownServer();
                        }
                    }
                });
            });
        } else {
            // 工作进程代码
            process.on('message', (msg) => {
                if (msg.type === 'assignId') {
                    // 设置工作进程ID
                    processIds.set(process.pid, msg.workerId);
                    log(LOG_LEVELS.INFO, `工作进程ID已分配: ${msg.workerId}`);
                }
            });
            
            // 捕获未处理的错误并报告给主进程
            process.on('uncaughtException', (error) => {
                process.send({ 
                    type: 'workerError', 
                    error: error.message,
                    fatal: true
                });
                log(LOG_LEVELS.ERROR, `工作进程发生未捕获异常: ${error.message}\n${error.stack}`);
                process.exit(1);
            });
            
            process.on('unhandledRejection', (reason, promise) => {
                process.send({ 
                    type: 'workerError', 
                    error: reason.message || reason,
                    fatal: true
                });
                log(LOG_LEVELS.ERROR, `工作进程发生未处理的Promise拒绝: ${reason}\n${reason instanceof Error ? reason.stack : ''}`);
                process.exit(1);
            });
            
            // 启动应用
            try {
                require('./app.js');
            } catch (error) {
                // 发送错误信息给主进程
                process.send({ 
                    type: 'workerError', 
                    error: error.message,
                    fatal: true
                });
                log(LOG_LEVELS.ERROR, `工作进程启动失败: ${error.message}\n${error.stack}`);
                process.exit(1);
            }
        }
    } catch (error) {
        log(LOG_LEVELS.ERROR, `启动过程中发生错误: ${error}\n${error.stack}`);
        process.exit(1);
    }
})();