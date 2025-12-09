const { isDatabaseConnected } = require('../utils/databaseClient');
const { log } = require('../utils/logger');

/**
 * 数据库连接状态检查中间件
 * 在数据库未连接时返回500错误
 */
async function databaseStatusMiddleware(req, res, next) {
    try {
        // 检查数据库连接状态
        if (!isDatabaseConnected()) {
            // 记录500错误访问日志
            const clientIP = req.realIP || req.ip || req.connection.remoteAddress || 
                            (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
            const method = req.method;
            const url = req.url;
            
            // 获取用户名
            let username = '未知用户';
            const token = req.cookies.token;
            if (token) {
                try {
                    const decoded = require('jsonwebtoken').verify(token, require('../config/config.json').encryptionKey);
                    username = decoded.username || '未知用户';
                } catch (error) {
                    // token无效，保持"未知用户"状态
                }
            }
            
            log('ERROR', `数据库连接失败: ${method} ${url}`, {
                clientIP,
                username,
                method,
                url,
                statusCode: 500
            });
            
            return res.status(500).json({ 
                error: '系统暂时不可用，请稍后再试' 
            });
        }
        next();
    } catch (error) {
        log('ERROR', `数据库状态检查中间件错误: ${error.message}`);
        // 出错时继续处理请求，避免因检查机制问题影响正常用户
        next();
    }
}

module.exports = databaseStatusMiddleware;