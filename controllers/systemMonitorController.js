const { log } = require('../utils/logger');

// 存储系统指标数据
let systemMetrics = {
    cpu: 0,
    memory: 0,
    network: { received: 0, transmitted: 0 },
    diskIO: { read: 0, write: 0 }, // 更新为磁盘IO速度
    onlineUsers: 0,
    history: []
};

// 接收来自主进程的系统指标数据
if (require('cluster').isWorker) {
    process.on('message', (msg) => {
        if (msg.type === 'systemMetrics') {
            systemMetrics = msg.data;
            log('DEBUG', `接收到系统指标数据: CPU=${systemMetrics.cpu}%, 内存=${systemMetrics.memory}%`);
        }
    });
}

/**
 * 获取实时系统监控数据
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSystemMetrics = async (req, res) => {
    try {
        res.json({
            success: true,
            data: systemMetrics
        });
    } catch (error) {
        log('ERROR', `获取系统监控数据失败: ${error.message}`);
        res.status(500).json({ error: '获取系统监控数据失败' });
    }
};

/**
 * 获取系统监控历史数据
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSystemMetricsHistory = async (req, res) => {
    try {
        res.json({
            success: true,
            data: systemMetrics.history
        });
    } catch (error) {
        log('ERROR', `获取系统监控历史数据失败: ${error.message}`);
        res.status(500).json({ error: '获取系统监控历史数据失败' });
    }
};