const jwt = require('jsonwebtoken');
const models = require('../models');
const config = require('../config/config.json');
const { logUnauthorizedAccess, log, LOG_LEVELS } = require('../utils/logger');

// 获取客户端IP地址的辅助函数
function getClientIP(req) {
    // 使用新添加的realIP（如果可用）
    if (req.realIP && req.realIP !== 'unknown') {
        return req.realIP;
    }
    
    // 回退到原来的IP获取逻辑
    return req.ip || req.connection.remoteAddress || 
           (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
}

// 认证中间件
exports.authMiddleware = async (req, res, next) => {
    // 明确排除认证相关路由，确保这些路由无需认证即可访问
    const excludedPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify',
        '/auth/login',
        '/auth/register'
    ];
    
    // 检查请求路径是否在排除列表中
    if (excludedPaths.includes(req.path) || req.path.startsWith('/auth/') || req.path.startsWith('/api/auth/')) {
        return next();
    }
    
    try {
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 从cookie或Authorization header获取token
        let token = req.cookies.token;
        
        // 如果cookie中没有token，尝试从Authorization header获取
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            // 检查Authorization header是否采用Bearer模式
            if (authHeader.startsWith('Bearer ')) {
                // 提取token部分
                token = authHeader.substring(7); // "Bearer "之后的部分
            }
        }

        // 如果仍然没有token，返回401错误
        if (!token) {
            logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 401, '缺少访问令牌');
            return res.status(401).json({ 
                message: '缺少访问令牌',
                redirect: '/login'
            });
        }

        // 验证token
        const decoded = jwt.verify(token, config.encryptionKey);
        
        // 查找用户
        const user = await models.User.findByPk(decoded.id || decoded.userId);
        
        // 如果用户不存在
        if (!user) {
            logUnauthorizedAccess(clientIP, decoded.username || '未知用户', req.method, req.path, 401, '用户不存在');
            return res.status(401).json({ 
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
        const clientIP = getClientIP(req);
        
        // 获取用户名（如果有）
        let username = '未知用户';
        try {
            const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
            if (token) {
                const decoded = jwt.decode(token);
                username = decoded.username || '未知用户';
            }
        } catch (decodeError) {
            // 解码失败则使用默认值
        }
        
        logUnauthorizedAccess(clientIP, username, req.method, req.path, 403, `令牌验证失败: ${error.message}`);
        res.status(403).json({ 
            message: '令牌验证失败',
            redirect: '/login'
        });
    }
};

// 管理员中间件
exports.adminMiddleware = (req, res, next) => {
    // 检查用户是否已通过认证
    if (!req.user) {
        return res.status(403).json({ message: '需要管理员权限' });
    }
    
    // 检查用户是否为管理员
    if (!req.user.isAdmin) {
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 记录未授权的管理员访问尝试
        logUnauthorizedAccess(clientIP, req.user.username, req.method, req.path, 403, '需要管理员权限');
        
        return res.status(403).json({ message: '需要管理员权限' });
    }
    
    next();
};