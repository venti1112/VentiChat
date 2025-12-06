const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config/config.json');

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

// 创建代理中间件
const proxyMiddleware = createProxyMiddleware({
    target: 'http://localhost:' + (parseInt(config.port) + 1), // 初始目标
    changeOrigin: true,
    router: function(req) {
        // 轮询选择工作进程
        const targetPort = workerPorts[currentWorkerIndex];
        currentWorkerIndex = (currentWorkerIndex + 1) % workerPorts.length;
        return 'http://localhost:' + targetPort;
    },
    onError: function(err, req, res) {
        console.error('代理错误:', err);
        res.writeHead(500, {
            'Content-Type': 'text/plain',
        });
        res.end('代理错误: ' + err.message);
    }
});

// 应用代理中间件到所有路由
app.use('/', proxyMiddleware);

app.listen(parseInt(config.port), () => {
    console.log(`Load balancer proxy listening on port ${config.port}`);
});