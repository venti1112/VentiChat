const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const configPath = path.join(__dirname, 'config', 'config.json');
const { log, LOG_LEVELS, logServerShutdown, processIds } = require('./utils/logger');

// 检查配置文件是否存在，如果不存在则运行初始化脚本
async function checkAndInitialize() {
    try {
        await fs.access(configPath);
        // 配置文件存在，正常加载
        return true;
    } catch (err) {
        // 配置文件不存在，运行初始化脚本
        console.log('配置文件不存在，正在运行初始化脚本...');
        return new Promise((resolve, reject) => {
            const initProcess = spawn('node', ['scripts/init.js'], { stdio: 'inherit' });
            
            initProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('初始化完成，继续启动应用...');
                    resolve(true);
                } else {
                    console.error('初始化失败，退出码:', code);
                    reject(false);
                }
            });
        });
    }
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
                const worker = cluster.fork();
                // 立即为工作进程分配内部编号
                const workerId = getNextWorkerId();
                workers[workerId] = worker;
                processIds.set(worker.process.pid, workerId);
                
                // 向工作进程发送其ID
                worker.send({ type: 'assignId', workerId: workerId });
            }
            
            // 处理工作进程间的消息转发
            Object.values(workers).forEach(worker => {
                worker.on('message', (msg) => {
                    // 如果消息需要转发到其他工作进程
                    if (msg.type === 'forwardToWorker') {
                        const targetWorker = workers[msg.targetWorkerId];
                        if (targetWorker) {
                            targetWorker.send(msg);
                        }
                    }
                });
            });
            
            cluster.on('exit', (worker, code, signal) => {
                const workerId = processIds.get(worker.process.pid);
                log(LOG_LEVELS.INFO, `工作进程 ${workerId} 已退出 (代码: ${code}, 信号: ${signal})`);
                log(LOG_LEVELS.INFO, '正在启动新的工作进程...');
                const newWorker = cluster.fork();
                const newWorkerId = getNextWorkerId();
                workers[newWorkerId] = newWorker;
                processIds.set(newWorker.process.pid, newWorkerId);
                
                // 向新工作进程发送其ID
                newWorker.send({ type: 'assignId', workerId: newWorkerId });
            });
        } else {
            // 工作进程接收主进程分配的ID
            process.on('message', (msg) => {
                if (msg.type === 'assignId') {
                    processIds.set(process.pid, msg.workerId);
                }
            });
            
            require('./app.js');
            // 工作进程的日志由 app.js 内部处理
        }
    } catch (error) {
        console.error('启动过程中发生错误:', error);
        process.exit(1);
    }
})();

process.on('SIGINT', () => {
    logServerShutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logServerShutdown();
    process.exit(0);
});