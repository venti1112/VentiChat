const cluster = require('cluster');
const os = require('os');
const path = require('path');
const config = require('./config/config.json');
const { log, LOG_LEVELS, logServerShutdown, processIds } = require('./utils/logger');

// 确定工作进程数量
const numCPUs = config.workerCount && config.workerCount > 0 ? config.workerCount : os.cpus().length;

// 下一个可用的工作进程ID
let nextWorkerId = 1;

// 获取下一个工作进程ID的函数
function getNextWorkerId() {
    return nextWorkerId++;
}

// 初始化进程编号
if (cluster.isMaster || cluster.isPrimary) {
    processIds.set(process.pid, 0); // 为主进程分配ID 0
    
    log(LOG_LEVELS.INFO, `主进程准备就绪，将创建 ${numCPUs} 个工作进程`);
    
    // 衍生工作进程
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
    }
    
    // 监听工作进程创建事件，在这里分配ID
    cluster.on('fork', (worker) => {
        const workerId = getNextWorkerId();
        processIds.set(worker.process.pid, workerId);
        // 通过环境变量将workerId传递给工作进程
        worker.send({ type: 'assignWorkerId', workerId });
        log(LOG_LEVELS.INFO, `已创建工作进程 ${workerId} PID: ${worker.process.pid}`);
    });
    
    // 监听工作进程的消息
    cluster.on('message', (worker, message) => {
        if (message.type === 'requestWorkerId') {
            const workerId = processIds.get(worker.process.pid);
            worker.send({ type: 'assignWorkerId', workerId });
        }
    });
    
    cluster.on('exit', (worker, code, signal) => {
        const workerId = processIds.get(worker.process.pid);
        log(LOG_LEVELS.INFO, `工作进程 ${workerId} 已退出 (代码: ${code}, 信号: ${signal})`);
        log(LOG_LEVELS.INFO, '正在启动新的工作进程...');
        const newWorker = cluster.fork();
    });
} else {
    // 工作进程代码
    // 监听来自主进程的消息
    process.on('message', (message) => {
        if (message.type === 'assignWorkerId') {
            const { processIds } = require('./utils/logger');
            processIds.set(process.pid, message.workerId);
        }
    });
    
    // 请求主进程分配workerId
    process.send({ type: 'requestWorkerId' });
    
    require('./app.js');
    // 工作进程的日志由 app.js 内部处理
}

process.on('SIGINT', () => {
    logServerShutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logServerShutdown();
    process.exit(0);
});