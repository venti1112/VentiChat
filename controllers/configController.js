const fs = require('fs');
const path = require('path');

// 获取配置文件路径
const configPath = path.join(__dirname, '..', 'config', 'config.json');

/**
 * 获取当前配置
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getConfig = async (req, res) => {
    try {
        // 检查配置文件是否存在
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({ error: '配置文件不存在' });
        }

        // 读取配置文件
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({ error: '读取配置文件失败: ' + error.message });
    }
};

/**
 * 更新配置
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.updateConfig = async (req, res) => {
    try {
        // 获取请求中的配置数据
        const newConfig = req.body;

        // 读取当前配置
        let currentConfig = {};
        if (fs.existsSync(configPath)) {
            const currentConfigData = fs.readFileSync(configPath, 'utf8');
            currentConfig = JSON.parse(currentConfigData);
        }

        // 合并配置（只更新提供的字段）
        const updatedConfig = { ...currentConfig, ...newConfig };

        // 处理数据库密码（如果未提供新密码，则保留原密码）
        if (!updatedConfig.db) {
            updatedConfig.db = currentConfig.db || {};
        }
        
        if (newConfig.db && newConfig.db.password === undefined && currentConfig.db && currentConfig.db.password) {
            updatedConfig.db.password = currentConfig.db.password;
        }

        // 处理Redis密码（如果未提供新密码，则保留原密码）
        if (!updatedConfig.redis) {
            updatedConfig.redis = currentConfig.redis || {};
        }
        
        if (newConfig.redis && newConfig.redis.password === undefined && currentConfig.redis && currentConfig.redis.password) {
            updatedConfig.redis.password = currentConfig.redis.password;
        }

        // 验证必要字段
        if (!updatedConfig.db || !updatedConfig.db.host || !updatedConfig.db.user || !updatedConfig.db.database) {
            return res.status(400).json({ error: '数据库配置不完整' });
        }

        if (!updatedConfig.redis || typeof updatedConfig.redis.host === 'undefined') {
            return res.status(400).json({ error: 'Redis配置不完整' });
        }

        if (!updatedConfig.encryptionKey) {
            return res.status(400).json({ error: '缺少加密密钥' });
        }

        if (!updatedConfig.port) {
            return res.status(400).json({ error: '缺少端口配置' });
        }

        // 写入新配置到文件
        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

        res.json({
            success: true,
            message: '配置更新成功',
            data: updatedConfig
        });
    } catch (error) {
        res.status(500).json({ error: '更新配置失败: ' + error.message });
    }
};