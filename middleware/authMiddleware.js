const jwt = require('jsonwebtoken');
const models = require('../models');
const config = require('../config/config.json');
const { logUnauthorizedAccess } = require('../utils/logger');

// 认证中间件
exports.authMiddleware = async (req, res, next) => {
    // 跳过所有认证相关的请求
    if (req.path.startsWith('/auth/')) {
        return next();
    }
    
    try {
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        
        // 从cookie获取token
        const token = req.cookies.token;
        if (!token) {
            logUnauthorizedAccess(clientIP, '未登录', req.method, req.path, 403, '未提供认证令牌');
            return res.status(403).json({ 
                message: '未提供认证令牌',
                redirect: '/login'
            });
        }
        
        // 验证token
        const decoded = jwt.verify(token, config.encryptionKey);
        
        // 检查token是否存在于数据库
        const dbToken = await models.Token.findOne({
          where: { token: token }
        });
        
        if (!dbToken) {
            logUnauthorizedAccess(clientIP, decoded.username || 'unknown', req.method, req.path, 403, '无效的认证令牌');
            return res.status(403).json({ 
              message: '无效的认证令牌',
              redirect: '/login'
            });
        }
        
        // 查找用户
        const user = await models.User.findByPk(decoded.id);
        if (!user) {
            logUnauthorizedAccess(clientIP, decoded.username || 'unknown', req.method, req.path, 403, '用户不存在');
            return res.status(403).json({ 
                message: '用户不存在',
                redirect: '/login'
            });
        }
        
        // 检查用户状态
        if (user.status === 'banned') {
            logUnauthorizedAccess(clientIP, user.username, req.method, req.path, 403, '账号已被封禁');
            return res.status(403).json({ 
                message: '账号已被封禁',
                redirect: '/login'
            });
        }
        
        // 验证通过，附加用户信息到请求对象
        req.user = user;
        next();
    } catch (error) {
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        
        // 获取用户名（如果有）
        const username = req.user ? req.user.username : '未知用户';
        
        logUnauthorizedAccess(clientIP, username, req.method, req.path, 403, '令牌验证失败');
        res.status(403).json({ 
            message: '令牌验证失败',
            redirect: '/login'
        });
    }
};

// 管理员中间件
exports.adminMiddleware = async (req, res, next) => {
    try {
        await exports.authMiddleware(req, res, async () => {
            if (req.user.role !== 'admin') {
                // 获取客户端IP
                const clientIP = req.ip || req.connection.remoteAddress || 
                                (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
                
                logUnauthorizedAccess(clientIP, req.user.username, req.method, req.path, 403, '需要管理员权限');
                return res.status(403).json({ error: '需要管理员权限' });
            }
            next();
        });
    } catch (error) {
        // authMiddleware 已经处理了错误响应
    }
};