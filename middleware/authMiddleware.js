const jwt = require('jsonwebtoken');
const models = require('../models');
const { verifyToken } = require('../utils/jwt'); // 正确导入verifyToken函数
const redisClient = require('../utils/redisClient');
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
    
    // 检查请求路径是否在排除列表中
    if (req.path.startsWith('/api/auth/')) {
        return next();
    }
    
    try {
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 从cookie获取token
        let token = req.cookies.token;

        // 如果没有token，返回401错误
        if (!token) {
            logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 401, '缺少访问令牌');
            return res.status(401).json({ 
                message: '缺少访问令牌'
            });
        }

        // 使用JWT验证token
        const decoded = verifyToken(token);
        
        // 如果token无效
        if (!decoded) {
            logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 401, '访问令牌无效');
            return res.status(401).json({ 
                message: '访问令牌无效'
            });
        }
        
        // 检查token是否存在于Redis中
        const storedToken = await redisClient.validateToken(token);
        if (!storedToken) {
            logUnauthorizedAccess(clientIP, decoded.username || '未知用户', req.method, req.path, 401, '访问令牌已过期或无效');
            return res.status(401).json({ 
                message: '访问令牌已过期或无效'
            });
        }
        
        // 查找用户
        const user = await models.User.findByPk(decoded.id || decoded.userId);
        
        // 如果用户不存在
        if (!user) {
            logUnauthorizedAccess(clientIP, decoded.username || '未知用户', req.method, req.path, 401, '用户不存在');
            return res.status(401).json({ 
                message: '用户不存在'
            });
        }
        
        // 检查用户状态
        if (user.status === 'banned') {
            logUnauthorizedAccess(clientIP, user.username, req.method, req.path, 403, '账号已被封禁');
            return res.status(403).json({ 
                message: '账号已被封禁'
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
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? 
                      req.headers.authorization.substring(7) : null);
        
        if (token) {
            try {
                const decoded = jwt.verify(token, config.encryptionKey);
                username = decoded.username || '未知用户';
            } catch (err) {
                // 忽略解析token的错误
            }
        }
        
        log('ERROR', `认证中间件错误: ${error.message}`, clientIP);
        res.status(500).json({ 
            message: '服务器内部错误',
            redirect: '/login'
        });
    }
};

// 管理员中间件
exports.adminMiddleware = (req, res, next) => {
    // 检查用户是否已通过认证
    if (!req.user) {
        const clientIP = getClientIP(req);
        logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 403, '需要管理员权限');
        return res.status(403).json({ 
            message: '需要管理员权限'
        });
    }
    
    // 检查用户是否为管理员
    if (!req.user.isAdmin) {
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 记录未授权的管理员访问尝试
        logUnauthorizedAccess(clientIP, req.user.username, req.method, req.path, 403, '需要管理员权限');
        
        return res.status(403).json({ 
            message: '需要管理员权限'
        });
    }
    
    next();
};