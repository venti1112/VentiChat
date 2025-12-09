const models = require('../models');
const { log } = require('../utils/logger');

/**
 * 获取系统设置
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSettings = async (req, res) => {
    try {
        const settings = await models.SystemSetting.findOne();
        
        if (!settings) {
            // 如果没有设置，创建默认设置
            const defaultSettings = await models.SystemSetting.create({});
            return res.json({
                success: true,
                data: defaultSettings
            });
        }
        
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        log('ERROR', `获取系统设置失败: ${error.message}`);
        res.status(500).json({ error: '获取系统设置失败: ' + error.message });
    }
};

/**
 * 更新系统设置
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.updateSettings = async (req, res) => {
    try {
        const updateData = req.body;
        
        // 获取现有设置或创建新设置
        let settings = await models.SystemSetting.findOne();
        if (!settings) {
            settings = await models.SystemSetting.create(updateData);
        } else {
            await settings.update(updateData);
        }
        
        res.json({
            success: true,
            message: '系统设置更新成功',
            data: settings
        });
    } catch (error) {
        log('ERROR', `更新系统设置失败: ${error.message}`);
        res.status(500).json({ error: '更新系统设置失败: ' + error.message });
    }
};

/**
 * 清除所有消息记录
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.clearAllMessages = async (req, res) => {
    try {
        // 删除所有消息
        await models.Message.destroy({
            where: {}
        });
        
        log('INFO', '管理员清除了所有消息记录');
        
        res.json({
            success: true,
            message: '所有消息记录已清除'
        });
    } catch (error) {
        log('ERROR', `清除所有消息记录失败: ${error.message}`);
        res.status(500).json({ error: '清除所有消息记录失败: ' + error.message });
    }
};