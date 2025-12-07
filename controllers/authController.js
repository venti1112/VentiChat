const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const { hashPassword, comparePassword } = require('../utils/auth');
const { verifyToken } = require('../utils/jwt');
const { log, logUserLogin, logUserLogout } = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const { User, SystemSetting } = require('../models/index');

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

// 登录
exports.login = async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body; // 添加rememberMe参数
        
        // 获取客户端IP
        const clientIP = getClientIP(req);
        
        // 验证输入
        if (!username || !password) {
            logUserLogin(clientIP, username, false, '用户名和密码不能为空');
            return res.status(400).json({ message: '用户名和密码不能为空' });
        }
        
        // 获取系统设置
        const systemSettings = await SystemSetting.findOne();
        const maxLoginAttempts = systemSettings?.maxLoginAttempts || 5;
        
        // 检查IP是否被封禁（使用Redis）
        const bannedIP = await redisClient.checkBannedIP(clientIP);
        
        // 如果IP被封禁且未到解封时间，并且失败次数达到上限
        if (bannedIP && new Date() < new Date(bannedIP.unbanTime) && bannedIP.failedAttempts >= maxLoginAttempts) {
            log('WARN', `被封禁IP尝试登录 - IP: ${clientIP}, 用户名: ${username}`);
            return res.status(403).json({ 
                message: '您的IP已被封禁，请稍后再试',
                redirect: '/login'
            });
        }
        
        // 如果IP被封禁但已到解封时间，则从封禁列表中移除
        if (bannedIP && new Date() >= new Date(bannedIP.unbanTime)) {
            await redisClient.removeBannedIP(clientIP);
        }
        
        // 查找用户
        const user = await User.findOne({ where: { username } });
        if (!user) {
            // 增加IP登录失败次数检查
            await handleFailedLoginAttempt(clientIP, username);
            
            logUserLogin(clientIP, username, false, '用户不存在');
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 检查用户状态
        if (user.status === 'banned') {
            logUserLogin(clientIP, username, false, '用户已被封禁');
            return res.status(403).json({ message: '用户已被封禁，无法登录' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            // 增加IP登录失败次数检查
            await handleFailedLoginAttempt(clientIP, username);
            
            logUserLogin(clientIP, username, false, '密码错误');
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 登录成功，清除该IP的失败登录记录
        await clearFailedLoginAttempts(clientIP);
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                id: user.userId, 
                username: user.username,
                isAdmin: user.isAdmin 
            }, 
            config.encryptionKey,
            { expiresIn: '24h' }
        );
        
        // 计算Cookie过期时间：如果rememberMe为true则7天，否则24小时
        const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        
        // 将token写入Cookie（开发环境放宽安全限制）
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
          httpOnly: isProduction, // 生产环境开启httpOnly保护
          secure: isProduction,   // 生产环境开启secure保护
          maxAge: maxAge,
          sameSite: 'lax'
        });
        
        // 存储token到Redis
        const expiresAt = new Date(Date.now() + maxAge);
        await redisClient.storeUserToken(token, user.userId, expiresAt);
        
        // 记录登录日志
        logUserLogin(clientIP, username, true);
        
        // 返回用户信息和token
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        log('ERROR', '登录错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 处理失败登录尝试
async function handleFailedLoginAttempt(clientIP, username) {
    try {
        // 获取系统设置
        const systemSettings = await SystemSetting.findOne();
        const maxLoginAttempts = systemSettings?.maxLoginAttempts || 5;
        const loginLockTime = (systemSettings?.loginLockTime || 30) * 60 * 1000; // 转换为毫秒
        
        // 增加IP失败尝试次数（使用Redis）
        const result = await redisClient.incrementIPFailures(clientIP, maxLoginAttempts, loginLockTime/60/1000);
        
        // 如果达到最大失败次数，记录日志
        if (result.banned) {
            const banDuration = loginLockTime / (60 * 1000); // 分钟
            log('WARN', `IP因多次登录失败被封禁 - IP: ${clientIP}, 用户名: ${username}, 封禁时长: ${banDuration}分钟`);
        }
    } catch (error) {
        log('ERROR', '处理失败登录尝试错误: ' + error);
    }
}

// 清除失败登录尝试记录
async function clearFailedLoginAttempts(clientIP) {
    try {
        // 登录成功，删除该IP的封禁记录（使用Redis）
        await redisClient.removeBannedIP(clientIP);
    } catch (error) {
        log('ERROR', '清除失败登录尝试记录错误: ' + error);
    }
}

// 注册
exports.register = async (req, res) => {
    try {
        const { username, nickname, password, confirmPassword } = req.body;
        let avatarUrl = '/default-avatar.png'; // 默认头像路径
        
        // 验证输入
        if (!username || !nickname || !password || !confirmPassword) {
            return res.status(400).json({ message: '所有字段都必须填写' });
        }
        
        if (password !== confirmPassword) {
            return res.status(400).json({ message: '两次输入的密码不一致' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: '密码至少需要8位字符' });
        }

        // 检查密码强度（至少包含字母和数字）
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: '密码必须包含字母和数字，可选择包含特殊字符' 
            });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ message: '用户名已存在' });
        }
        
        // 哈希密码
        const passwordHash = await hashPassword(password);
        
        // 创建用户
        const user = await User.create({
            username,
            nickname,
            passwordHash,
            avatarUrl
        });
        
        // 加入默认大聊天室
        const Room = req.app.get('models').Room;
        const RoomMember = req.app.get('models').RoomMember;
        const defaultRoom = await Room.findOne({ where: { name: 'VentiChat大厅' } });
        if (defaultRoom) {
            await RoomMember.create({
                userId: user.userId,
                roomId: defaultRoom.roomId
            });
        }
        
        log('INFO', `新用户注册: ${username} (${user.userId})`);
        
        res.status(201).json({ 
            message: '注册成功',
            user: {
                id: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl
            }
        });
    } catch (error) {
        log('ERROR', '注册错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 检查用户名是否存在
exports.checkUsername = async (req, res) => {
    try {
        const { username } = req.body;
        
        // 验证输入
        if (!username) {
            return res.status(400).json({ message: '用户名不能为空' });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ where: { username } });
        
        res.json({ 
            exists: !!existingUser,
            message: existingUser ? '用户名已存在' : '用户名可用'
        });
    } catch (error) {
        log('ERROR', '检查用户名错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 退出登录
exports.logout = async (req, res) => {
    try {
        // 获得token
        const token = req.cookies.token;

        if (token) {
            // 从Redis中删除token
            await redisClient.removeToken(token);
        }

        // 清除cookie
        res.clearCookie('token');

        // 记录退出日志
        // 尝试从JWT token中获取用户名（即使认证中间件未附加req.user）
        let username = '未知用户';
        try {
            if (token) {
                const decoded = jwt.verify(token, config.encryptionKey);
                username = decoded.username || '未知用户';
            }
        } catch (error) {
            // 如果token无效，保持默认值
        }
        
        logUserLogout(req.ip, username, true);
        res.json({ message: '退出登录成功' });
    } catch (error) {
        log('ERROR', '退出登录错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 验证token
exports.verifyToken = async (req, res) => {
    try {
        // 优先从Authorization头部获取token，其次从cookie
        const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: '未提供认证令牌' });
        }

        // 使用utils/jwt.js中的verifyToken函数验证JWT签名
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({ message: '令牌无效' });
        }
        
        // 检查token是否存在于Redis中
        const storedToken = await redisClient.validateToken(token);
        if (!storedToken) {
            return res.status(401).json({ message: '令牌无效或已过期' });
        }

        // 获取用户信息
        const user = await User.findByPk(decoded.userId || decoded.id);
        if (!user) {
            return res.status(401).json({ message: '用户不存在' });
        }

        // 检查用户状态
        if (user.status === 'banned') {
            return res.status(403).json({ message: '用户已被封禁' });
        }

        res.json({
            valid: true,
            message: '令牌有效',
            user: {
                id: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '令牌已过期' });
        }
        log('ERROR', '验证令牌错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};