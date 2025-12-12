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
 * 获取实时系统监控数据（公开接口）
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getPublicSystemMetrics = async (req, res) => {
    try {
        // 检查系统监控是否启用
        const settings = await require('../models').SystemSetting.findOne();
        const isMonitorEnabled = settings ? settings.enableSystemMonitor : true;
        
        if (!isMonitorEnabled) {
            return res.json({
                success: true,
                data: {
                    monitoringEnabled: false,
                    message: '系统监控已禁用'
                }
            });
        }
        
        // 从Redis获取最新的系统监控数据
        const metrics = await systemMonitor.getLatestMetricsFromRedis();
        
        if (metrics) {
            res.json({
                success: true,
                data: {
                    monitoringEnabled: true,
                    cpu: metrics.cpu || 0,
                    memory: metrics.memory || 0,
                    network: metrics.network || { received: 0, transmitted: 0 },
                    diskIO: metrics.diskIO || { read: 0, write: 0 },
                    onlineUsers: metrics.onlineUsers || 0
                }
            });
        } else {
            // 如果Redis中没有数据，则返回空数据
            res.json({
                success: true,
                data: {
                    monitoringEnabled: true,
                    cpu: 0,
                    memory: 0,
                    network: { received: 0, transmitted: 0 },
                    diskIO: { read: 0, write: 0 },
                    onlineUsers: 0
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

/**
 * 获取系统监控历史数据（公开接口）
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getPublicSystemMetricsHistory = async (req, res) => {
    try {
        // 检查系统监控是否启用
        const settings = await require('../models').SystemSetting.findOne();
        const isMonitorEnabled = settings ? settings.enableSystemMonitor : true;
        
        if (!isMonitorEnabled) {
            return res.json({
                success: true,
                data: []
            });
        }
        
        // 从Redis获取历史系统监控数据
        const history = await systemMonitor.getHistoryFromRedis();
        
        // 确保历史数据中的每条记录都包含必要的字段，特别是onlineUsers
        const processedHistory = (history || []).map(record => ({
            timestamp: record.timestamp,
            cpu: record.cpu || 0,
            memory: record.memory || 0,
            network: record.network || { received: 0, transmitted: 0 },
            diskIO: record.diskIO || { read: 0, write: 0 },
            onlineUsers: record.onlineUsers || 0
        }));
        
        res.json({
            success: true,
            data: processedHistory
        });
    } catch (error) {
        log('ERROR', `获取系统监控历史数据失败: ${error.message}`);
        res.status(500).json({ error: '获取系统监控历史数据失败' });
    }
};