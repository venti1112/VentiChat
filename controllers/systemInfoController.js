const os = require('os');
const { log } = require('../utils/logger');

/**
 * 将秒数转换为易读的格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= 24 * 3600;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}天${hours}小时${minutes}分钟`;
    } else if (hours > 0) {
        return `${hours}小时${minutes}分钟${seconds}秒`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds}秒`;
    } else {
        return `${seconds}秒`;
    }
}

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
            freemem: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB',
            uptime: formatUptime(os.uptime()) // 添加运行时间信息
        };

        res.json(sysInfo);
    } catch (error) {
        log('ERROR', `获取系统信息失败: ${error.message}`);
        res.status(500).json({ error: '获取系统信息失败' });
    }
};