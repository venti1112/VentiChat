const { log } = require('../utils/logger');
const systemMonitor = require('../utils/systemMonitor');

/**
 * 获取实时系统监控数据
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSystemMetrics = async (req, res) => {
    try {
        // 从Redis获取最新的系统监控数据
        const metrics = await systemMonitor.getLatestMetricsFromRedis();
        
        if (metrics) {
            res.json({
                success: true,
                data: metrics
            });
        } else {
            // 如果Redis中没有数据，则返回空数据
            res.json({
                success: true,
                data: {
                    cpu: 0,
                    memory: 0,
                    memoryDetails: { total: 0, active: 0, available: 0 },
                    network: { received: 0, transmitted: 0 },
                    diskIO: { read: 0, write: 0 },
                    onlineUsers: 0,
                    history: []
                }
            });
        }
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
        // 从Redis获取历史系统监控数据
        const history = await systemMonitor.getHistoryFromRedis();
        
        res.json({
            success: true,
            data: history || []
        });
    } catch (error) {
        log('ERROR', `获取系统监控历史数据失败: ${error.message}`);
        res.status(500).json({ error: '获取系统监控历史数据失败' });
    }
};