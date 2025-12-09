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
        return `${days}天${hours}小时${minutes}分钟${seconds}秒`;
    } else if (hours > 0) {
        return `${hours}小时${minutes}分钟${seconds}秒`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds}秒`;
    } else {
        return `${seconds}秒`;
    }
}

/**
 * 获取系统启动时间戳（毫秒）
 * @returns {number} 系统启动时间戳
 */
function getBootTime() {
    // 计算系统启动时间 = 当前时间 - 系统运行时间
    return Date.now() - (os.uptime() * 1000);
}

/**
 * 获取系统信息
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getSystemInfo = async (req, res) => {
    try {
        // 实时计算运行时间
        const bootTime = getBootTime();
        const currentTime = Date.now();
        const uptimeSeconds = Math.floor((currentTime - bootTime) / 1000);
        
        const sysInfo = {
            nodeVersion: process.version,
            osInfo: `${os.type()} ${os.release()} (${os.platform()})`,
            arch: os.arch(),
            cpus: os.cpus().length,
            totalmem: Math.round(os.totalmem() / (1024 * 1024)) + ' MB',
            freemem: Math.round(os.freemem() / (1024 * 1024)) + ' MB',
            uptime: formatUptime(uptimeSeconds) // 实时计算运行时间
        };

        res.json(sysInfo);
    } catch (error) {
        log('ERROR', `获取系统信息失败: ${error.message}`);
        res.status(500).json({ error: '获取系统信息失败' });
    }
};