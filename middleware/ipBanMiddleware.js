const redisClient = require('../utils/redisClient');
const { log, LOG_LEVELS } = require('../utils/logger');
const { SystemSetting } = require('../models');

// IP封禁中间件
async function ipBanMiddleware(req, res, next) {
    try {
        const clientIP = req.realIP || req.ip;
        
        // 检查IP是否被封禁
        const banInfo = await redisClient.checkBannedIP(clientIP);
        
        if (banInfo) {
            // IP被封禁，但我们需要检查是否达到了最大失败次数
            const systemSettings = await SystemSetting.findOne();
            const maxLoginAttempts = systemSettings?.maxLoginAttempts || 5;
            
            // 只有在失败次数达到上限时才阻止访问
            if (banInfo.failedAttempts >= maxLoginAttempts && new Date() < new Date(banInfo.unbanTime)) {
                log(LOG_LEVELS.WARN, `被封禁IP尝试访问: ${clientIP}`);
                return res.status(403).json({ 
                    error: '访问被拒绝：由于多次失败尝试，您的IP已被临时封禁',
                    unbanTime: banInfo.unbanTime
                });
            }
        }
        
        // 将clientIP附加到请求对象，供后续中间件使用
        req.clientIP = clientIP;
        
        // IP未被封禁，继续处理请求
        next();
    } catch (error) {
        log(LOG_LEVELS.ERROR, `IP封禁检查失败: ${error.message}`);
        // 出错时继续处理请求，避免因Redis问题影响正常用户
        next();
    }
}

module.exports = ipBanMiddleware;