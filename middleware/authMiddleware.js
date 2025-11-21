const jwt = require('jsonwebtoken');
const models = require('../models');
const config = require('../config/config.json');
const { logUnauthorizedAccess, log, LOG_LEVELS } = require('../utils/logger');

// 认证中间件
exports.authMiddleware = async (req, res, next) => {
    // 跳过所有认证相关的请求
    if (req.path.startsWith('/auth/')) {
        return next();
    }
    
    try {
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
        
        // 从cookie获取token
        const token = req.cookies.token;
        if (!token) {
            logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 403, '未提供认证令牌');
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
            logUnauthorizedAccess(clientIP, decoded.username || '未知用户', req.method, req.path, 403, '无效的认证令牌（数据库中未找到）');
            return res.status(403).json({ 
              message: '无效的认证令牌',
              redirect: '/login'
            });
        }
        
        // 查找用户
        const user = await models.User.findByPk(decoded.userId || decoded.id);
        if (!user) {
            logUnauthorizedAccess(clientIP, decoded.username || '未知用户', req.method, req.path, 403, '用户不存在');
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
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
        
        // 获取用户名（如果有）
        let username = '未知用户';
        try {
            const token = req.cookies.token;
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
exports.adminMiddleware = async (req, res, next) => {
    // 先进行常规认证
    await new Promise((resolve, reject) => {
        exports.authMiddleware(req, res, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    }).catch(next);
    
    try {
        // 检查用户是否存在
        if (!req.user) {
            const clientIP = req.ip || req.connection.remoteAddress || 
                           (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
            logUnauthorizedAccess(clientIP, '未知用户', req.method, req.path, 403, '用户未认证');
            return res.status(403).json({ error: '需要管理员权限' });
        }

        // 首先检查配置文件中的管理员用户名
        if (req.user.username !== config.adminUsername) {
            // 如果不匹配，再查询数据库确认用户是否为管理员
            const adminUser = await models.User.findOne({
                where: {
                    username: config.adminUsername
                }
            });

            // 检查当前用户是否与数据库中的管理员用户一致
            if (!adminUser || req.user.id !== adminUser.id) {
                // 获取客户端IP
                const clientIP = req.ip || req.connection.remoteAddress || 
                                (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
                
                logUnauthorizedAccess(clientIP, req.user.username, req.method, req.path, 403, '需要管理员权限');
                return res.status(403).json({ error: '需要管理员权限' });
            }
        }
        next();
    } catch (dbError) {
        log(LOG_LEVELS.ERROR, `管理员权限验证过程中发生数据库错误: ${dbError.message}`);
        // 发生数据库错误时，默认拒绝访问
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
        
        let username = '未知用户';
        if (req.user) {
            username = req.user.username;
        } else {
            try {
                const token = req.cookies.token;
                if (token) {
                    const decoded = jwt.decode(token);
                    username = decoded.username || '未知用户';
                }
            } catch (decodeError) {
                // 解码失败则使用默认值
            }
        }
        
        logUnauthorizedAccess(clientIP, username, req.method, req.path, 500, '服务器内部错误');
        return res.status(500).json({ error: '服务器内部错误' });
    }
};