const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const { hashPassword, comparePassword } = require('../utils/auth');
const { generateToken, verifyToken } = require('../utils/jwt');
const { log, logUserLogin, logUserLogout } = require('../utils/logger');

// 修复：正确导入User模型和新的BanIp、SystemSetting模型
const { User, Token, SystemSetting, BanIp } = require('../models/index');

// 获取客户端IP地址的辅助函数
function getClientIP(req) {
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
        
        // 检查IP是否被封禁
        const bannedIP = await BanIp.findOne({
            where: {
                ip: clientIP
            }
        });
        
        // 如果IP被封禁且未到解封时间，并且失败次数达到上限
        if (bannedIP && new Date() < new Date(bannedIP.unbanTime)) {
            // 获取系统设置
            const systemSettings = await SystemSetting.findOne();
            const maxLoginAttempts = systemSettings?.maxLoginAttempts || 5;
            
            // 只有在失败次数达到上限时才阻止登录
            if (bannedIP.failedAttempts >= maxLoginAttempts) {
                log('WARN', `被封禁IP尝试登录 - IP: ${clientIP}, 用户名: ${username}`);
                return res.status(403).json({ 
                    message: '您的IP已被封禁，请稍后再试',
                    redirect: '/login'
                });
            }
        }
        
        // 如果IP被封禁但已到解封时间，则从封禁列表中移除
        if (bannedIP && new Date() >= new Date(bannedIP.unbanTime)) {
            await BanIp.destroy({
                where: {
                    ip: clientIP
                }
            });
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
        
        // 存储token到数据库
        const expiresAt = new Date(Date.now() + maxAge);
        await Token.create({
            tokenStr: token,
            userId: user.userId,
            expiresAt: expiresAt
        });
        
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
        
        // 查找该IP的失败登录记录
        let ipRecord = await BanIp.findOne({
            where: {
                ip: clientIP
            }
        });
        
        const now = new Date();
        
        if (ipRecord) {
            // 如果记录存在，增加失败次数
            const currentAttempts = (ipRecord.failedAttempts || 0) + 1;
            
            // 如果还在封禁期内，不增加次数
            if (now < new Date(ipRecord.unbanTime)) {
                return;
            }
            
            // 如果封禁期已过，重新计算
            const newUnbanTime = new Date(now.getTime() + loginLockTime);
            await BanIp.update({
                banTime: now,
                unbanTime: newUnbanTime,
                failedAttempts: currentAttempts
            }, {
                where: {
                    ip: clientIP
                }
            });
            
            // 如果达到最大失败次数，记录日志
            if (currentAttempts >= maxLoginAttempts) {
                const banDuration = loginLockTime / (60 * 1000); // 分钟
                log('WARN', `IP因多次登录失败被封禁 - IP: ${clientIP}, 用户名: ${username}, 封禁时长: ${banDuration}分钟`);
            }
        } else {
            // 如果没有记录，创建新记录
            const unbanTime = new Date(now.getTime() + loginLockTime);
            await BanIp.create({
                ip: clientIP,
                banTime: now,
                unbanTime: unbanTime,
                failedAttempts: 1
            });
        }
    } catch (error) {
        log('ERROR', '处理失败登录尝试错误: ' + error);
    }
}

// 清除失败登录尝试记录
async function clearFailedLoginAttempts(clientIP) {
    try {
        // 登录成功，删除该IP的封禁记录
        await BanIp.destroy({
            where: {
                ip: clientIP
            }
        });
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
        
        // 如果有上传头像文件，则使用上传的头像
        if (req.file) {
            avatarUrl = `/userdata/avatar/${req.file.filename}`;
        }
        
        // 创建新用户
        const hashedPassword = await hashPassword(password);
        const newUser = await User.create({
            username,
            nickname: nickname || username,
            passwordHash: hashedPassword,
            avatarUrl: avatarUrl
        });

        // 记录注册日志
        log('INFO', `新用户注册: ${username}(ID: ${newUser.userId})`);

        // 获取大厅房间（VentiChat大厅）
        const Room = require('../models/index').Room;
        const RoomMember = require('../models/index').RoomMember;
        const hallRoom = await Room.findOne({
            where: {
                name: 'VentiChat大厅'
            }
        });

        // 如果大厅房间存在，将新用户加入其中
        if (hallRoom) {
            await RoomMember.create({
                userId: newUser.userId,
                roomId: hallRoom.roomId,
                isModerator: false
            });
        }

        // 注册成功后，不自动登录，仅返回成功消息
        res.json({ message: '注册成功' });
    } catch (error) {
        log('ERROR', '注册错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 退出登录
exports.logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

        if (token) {
            // 从数据库中删除token
            await Token.destroy({ where: { tokenStr: token } });
        }

        // 清除cookie
        res.clearCookie('token');

        // 记录退出日志
        logUserLogout(req.ip, req.user?.username);

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

        // 验证JWT签名
        const decoded = jwt.verify(token, config.encryptionKey);
        
        // 检查token是否存在于数据库中
        const storedToken = await Token.findOne({ where: { tokenStr: token } });
        if (!storedToken) {
            return res.status(401).json({ message: '令牌无效或已过期' });
        }

        // 检查令牌是否过期
        if (storedToken.expiresAt < new Date()) {
            await Token.destroy({ where: { tokenStr: token } });
            return res.status(401).json({ message: '令牌已过期' });
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: '令牌无效' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '令牌已过期' });
        }
        log('ERROR', '验证令牌错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};