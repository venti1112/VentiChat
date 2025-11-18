const jwt = require('jsonwebtoken');
const { models } = require('../app');

// 认证中间件
exports.authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }
        
        const decoded = jwt.verify(token, process.env.ENCRYPTION_KEY || 'your-secret-key');
        const user = await models.User.findByPk(decoded.id);
        
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }
        
        if (user.status === 'banned') {
            return res.status(403).json({ error: '账号已被封禁' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: '无效的认证令牌' });
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