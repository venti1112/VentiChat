const os = require('os');
const { log } = require('../utils/logger');

/**
 * 获取系统信息
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSystemInfo = async (req, res) => {
    try {
        const sysInfo = {
            nodeVersion: process.version,
            osInfo: `${os.type()} ${os.release()} (${os.platform()})`,
            arch: os.arch(),
            cpus: os.cpus().length,
            totalmem: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
            freemem: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB'
        };

        res.json(sysInfo);
    } catch (error) {
        log('ERROR', `获取系统信息失败: ${error.message}`);
        res.status(500).json({ error: '获取系统信息失败' });
    }
};