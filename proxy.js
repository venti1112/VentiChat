const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config/config.json');
const { log, LOG_LEVELS } = require('./utils/logger');
const http = require('http');

// 获取工作进程数量
const numCPUs = config.workerCount && config.workerCount > 0 ? config.workerCount : require('os').cpus().length;

// 创建代理服务器
const app = express();

// 获取工作进程端口列表
const workerPorts = [];
for (let i = 0; i < numCPUs; i++) {
    workerPorts.push(parseInt(config.port) + i + 1);
}

let currentWorkerIndex = 0;

// 创建HTTP代理中间件
const proxyMiddleware = createProxyMiddleware({
    target: 'http://localhost:' + (parseInt(config.port) + 1), // 初始目标
    changeOrigin: true,
    router: function(req) {
        // 轮询选择工作进程
        const targetPort = workerPorts[currentWorkerIndex];
        currentWorkerIndex = (currentWorkerIndex + 1) % workerPorts.length;
        return 'http://localhost:' + targetPort;
    },
    onProxyReq: (proxyReq, req, res) => {
        // 添加日志记录
        log(LOG_LEVELS.DEBUG, `代理HTTP请求: ${req.method} ${req.url} -> 端口 ${new URL(proxyReq.path, 'http://' + proxyReq.getHeader('host')).port}`);
    },
    onError: function(err, req, res) {
        log(LOG_LEVELS.ERROR, '代理错误: ' + err.message);
        res.writeHead(500, {
            'Content-Type': 'text/plain',
        });
        res.end('代理错误: ' + err.message);
    }
});

// 应用代理中间件到所有HTTP路由
app.use('/', proxyMiddleware);

// 创建HTTP服务器
const server = http.createServer(app);

// 处理WebSocket升级请求
server.on('upgrade', (req, socket, head) => {
    // 轮询选择工作进程
    const targetPort = workerPorts[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % workerPorts.length;
    
    // 创建目标URL
    const targetUrl = 'http://localhost:' + targetPort;
    
    log(LOG_LEVELS.INFO, `代理WebSocket升级请求到端口 ${targetPort}`);
    
    // 将WebSocket升级请求代理到选定的工作进程
    proxyMiddleware.upgrade(req, socket, head, {
        target: targetUrl,
        changeOrigin: true
    }, (err) => {
        if (err) {
            log(LOG_LEVELS.ERROR, 'WebSocket代理错误: ' + err.message);
            socket.destroy();
        } else {
            log(LOG_LEVELS.INFO, `WebSocket连接已建立到端口 ${targetPort}`);
        }
    });
});

server.listen(parseInt(config.port), () => {
    log(LOG_LEVELS.INFO, `代理服务器已监听端口 ${config.port}`);
});