const models = require('../models');
const { log } = require('../utils/logger');

// 获取客户端IP地址的辅助函数
function getClientIP(req) {
    // 使用新添加的realIP（如果可用）
    if (req.realIP && req.realIP !== 'unknown') {
        return req.realIP;
    }
    
    // 回退到原来的IP获取逻辑
    return req.ip || 
           req.connection.remoteAddress || 
           (req.headers['x-forwarded-for'] || '').split(',')[0] || 
           '未知IP';
}

// IP封禁中间件
async function ipBanMiddleware(req, res, next) {
    try {
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 检查IP是否在封禁列表中
        const bannedIP = await models.BanIp.findOne({
            where: {
                ip: clientIP
            }
        });
        
        // 如果IP被封禁且未到解封时间
        if (bannedIP && new Date() < new Date(bannedIP.unbanTime)) {
            // 获取系统设置
            const systemSettings = await models.SystemSetting.findOne();
            const maxLoginAttempts = systemSettings?.maxLoginAttempts || 5;
            
            // 只有在失败次数达到上限时才阻止访问
            if (bannedIP.failedAttempts >= maxLoginAttempts) {
                // 记录访问被封禁IP的尝试
                log('WARN', `被封禁IP尝试访问 - IP: ${clientIP}, 路径: ${req.path}`);
                
                // 返回403错误
                return res.status(403).json({
                    message: '您的IP已被封禁，请稍后再试',
                    redirect: '/login'
                });
            }
        }
        
        // 如果IP被封禁但已到解封时间，则从封禁列表中移除
        if (bannedIP && new Date() >= new Date(bannedIP.unbanTime)) {
            await models.BanIp.destroy({
                where: {
                    ip: clientIP
                }
            });
        }
        
        // 继续处理请求
        next();
    } catch (error) {
        console.error('IP封禁检查出错:', error);
        // 出错时继续处理请求，避免因数据库错误导致服务不可用
        next();
    }
}

module.exports = ipBanMiddleware;