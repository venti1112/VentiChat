const jwt = require('jsonwebtoken');
const { models } = require('../app');

// 认证中间件
exports.authMiddleware = async (req, res, next) => {
    // 跳过所有认证相关的请求
    if (req.path.startsWith('/auth/')) {
        return next();
    }
    
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(403).json({ error: '未提供认证令牌' });
        }
        
        const decoded = jwt.verify(token, process.env.ENCRYPTION_KEY || 'your-secret-key');
        const user = await models.User.findByPk(decoded.id);
        
        if (!user) {
            return res.status(403).json({ error: '用户不存在' });
        }
        
        if (user.status === 'banned') {
            return res.status(403).json({ error: '账号已被封禁' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(403).json({ error: '无效的认证令牌' });
    }
};

// 管理员中间件
exports.adminMiddleware = async (req, res, next) => {
    try {
        await exports.authMiddleware(req, res, async () => {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: '需要管理员权限' });
            }
            next();
        });
    } catch (error) {
        // authMiddleware 已经处理了错误响应
    }
};