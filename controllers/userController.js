const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { generateToken, removeToken, removeAllUserTokens } = require('../utils/auth');
const { logUserLogin, logUserLogout, LOG_LEVELS, log } = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config/config.json');

// 用户登录
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientIP = req.realIP || req.ip;
        
        // 获取系统设置
        const models = req.app.get('models');
        const systemSettings = await models.SystemSetting.findOne();
        const maxLoginAttempts = systemSettings ? systemSettings.maxLoginAttempts : 5;
        const lockTime = systemSettings ? systemSettings.loginLockTime : 30;
        
        // 检查IP是否被封禁
        const banInfo = await redisClient.checkBannedIP(clientIP);
        if (banInfo) {
            logUserLogin(clientIP, username, false, 'IP被封禁');
            return res.status(403).json({ 
                error: '访问被拒绝：由于多次失败尝试，您的IP已被临时封禁',
                unbanTime: banInfo.unbanTime
            });
        }
        
        // 查找用户
        const User = models.User;
        const user = await User.findOne({ where: { username } });
        if (!user) {
            // 增加失败尝试次数
            const failResult = await redisClient.incrementIPFailures(clientIP, maxLoginAttempts, lockTime);
            
            logUserLogin(clientIP, username, false, '用户不存在');
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 检查用户状态
        if (user.status === 'banned') {
            logUserLogin(clientIP, username, false, '用户被封禁');
            return res.status(403).json({ error: '用户账号已被封禁' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            // 增加失败尝试次数
            const failResult = await redisClient.incrementIPFailures(clientIP, maxLoginAttempts, lockTime);
            
            logUserLogin(clientIP, username, false, '密码错误');
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 登录成功，清除失败尝试记录
        await redisClient.removeBannedIP(clientIP);
        await redisClient.clearIPFailures(clientIP);
        
        // 重置登录尝试次数
        await user.update({ loginAttempts: 0, lastLoginAttempt: new Date() });
        
        // 生成Token
        const payload = { 
            id: user.userId, 
            userId: user.userId, 
            username: user.username 
        };
        
        const token = await generateToken(payload, user.userId);
        
        // 设置Cookie
        res.cookie('token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24小时
        });
        
        logUserLogin(clientIP, username, true);
        
        res.json({ 
            message: '登录成功',
            user: {
                userId: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                backgroundUrl: user.backgroundUrl,
                themeColor: user.themeColor,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        log(LOG_LEVELS.ERROR, `用户登录错误: ${error.message}`);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

// 获取用户个人资料
exports.getProfile = async (req, res) => {
    try {
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 通过用户ID获取用户信息（供其他用户查询）
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const User = req.app.get('models').User;
        
        // 验证用户ID是否为数字
        if (!userId || isNaN(userId) || userId === 'undefined' || userId === 'null' || String(userId).trim() === '' || String(userId).trim() === 'undefined') {
            return res.status(400).json({ error: '无效的用户ID' });
        }
        
        const user = await User.findByPk(userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 获取用户个性化设置
exports.getUserPreferences = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 通过req.app.get('models')获取User模型
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl', 'themeColor']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            backgroundUrl: user.backgroundUrl || '/wp.jpg',
            themeColor: user.themeColor || '#4cd8b8'
        });
    } catch (error) {
        console.error('获取用户偏好设置失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 用户退出登录
exports.logout = async (req, res) => {
    try {
        const clientIP = req.realIP || req.ip;
        const token = req.cookies.token;
        let username = '未知用户';
        
        if (token) {
            // 解码Token获取用户名
            try {
                const decoded = jwt.verify(token, config.jwt.secret);
                username = decoded.username;
                
                // 从Redis中移除Token
                await removeToken(token);
            } catch (error) {
                // Token无效，不影响退出流程
            }
        }
        
        // 清除Cookie
        res.clearCookie('token');
        
        logUserLogout(clientIP, username, true);
        
        res.json({ message: '退出登录成功' });
    } catch (error) {
        log(LOG_LEVELS.ERROR, `用户退出登录错误: ${error.message}`);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

// 强制退出登录（管理员功能）
exports.forceLogout = async (req, res) => {
    try {
        const { userId } = req.params;
        const clientIP = req.realIP || req.ip;
        
        // 移除用户的所有Tokens
        await removeAllUserTokens(userId);
        
        log(LOG_LEVELS.INFO, `管理员 ${req.user.username} 强制用户 ${userId} 退出登录 - IP: ${clientIP}`);
        
        res.json({ message: '用户已强制退出登录' });
    } catch (error) {
        log(LOG_LEVELS.ERROR, `强制用户退出登录错误: ${error.message}`);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

// 用户注册
exports.register = async (req, res) => {
    try {
        const { username, password, nickname } = req.body;
        
        // 检查用户名是否已存在
        const User = req.app.get('models').User;
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }
        
        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // 设置默认头像
        const defaultAvatarUrl = '/default-avatar.png';
        
        // 创建用户
        const user = await User.create({
            username,
            passwordHash,
            nickname: nickname || username,
            avatarUrl: defaultAvatarUrl
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
        
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户资料
exports.updateProfile = async (req, res) => {
    try {
        const { nickname } = req.body;
        
        // 准备更新数据
        const updateData = {
            nickname: nickname || req.user.nickname
        };
        
        // 如果有上传头像文件，则更新头像URL
        if (req.file) {
            updateData.avatarUrl = getAvatarUrl(req.file.filename);
        }
        
        const User = req.app.get('models').User;
        await User.update(
            updateData,
            {
                where: { userId: req.user.userId }
            }
        );
        
        // 获取更新后的用户信息
        const updatedUser = await User.findByPk(req.user.userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json({ 
            message: '资料更新成功',
            user: {
                id: updatedUser.userId,
                username: updatedUser.username,
                nickname: updatedUser.nickname,
                avatarUrl: updatedUser.avatarUrl || '/default-avatar.png'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 搜索用户
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.json([]);
        }
        
        const User = req.app.get('models').User;
        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { username: { [Sequelize.Op.like]: `%${query}%` } },
                    { nickname: { [Sequelize.Op.like]: `%${query}%` } }
                ]
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取用户头像URL
exports.getAvatarUrl = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 如果没有提供userId，则返回当前用户的头像URL
        const targetUserId = userId || req.user.userId;
        
        const User = req.app.get('models').User;
        const user = await User.findByPk(targetUserId, {
            attributes: ['avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户偏好设置
exports.updateUserPreferences = async (req, res) => {
    try {
        const { backgroundUrl, themeColor } = req.body;
        
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 准备更新数据
        const updateData = {};
        if (backgroundUrl !== undefined) updateData.backgroundUrl = backgroundUrl;
        if (themeColor !== undefined) updateData.themeColor = themeColor;
        
        const User = req.app.get('models').User;
        const [updatedRowsCount] = await User.update(
            updateData,
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 获取更新后的用户偏好设置
        const updatedUser = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl', 'themeColor']
        });
        
        res.json({
            message: '偏好设置更新成功',
            preferences: {
                backgroundUrl: updatedUser.backgroundUrl || '/wp.jpg',
                themeColor: updatedUser.themeColor || '#4cd8b8'
            }
        });
    } catch (error) {
        console.error('更新用户偏好设置失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 上传背景图片
exports.uploadBackground = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 检查是否有上传文件
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        
        // 获取用户当前的背景图片URL
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl']
        });
        const oldBackgroundUrl = user?.backgroundUrl;

        // 构造新的背景图片URL
        const backgroundUrl = `/api/userdata/background/${req.file.filename}`;
        
        // 更新用户背景图片URL
        const [updatedRowsCount] = await User.update(
            { backgroundUrl },
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 删除旧的背景图片文件（如果存在且不是默认背景）
        if (oldBackgroundUrl && !oldBackgroundUrl.includes('wp.jpg')) {
            const oldBackgroundPath = path.join(__dirname, '..', 'public', oldBackgroundUrl);
            if (fs.existsSync(oldBackgroundPath)) {
                fs.unlinkSync(oldBackgroundPath);
            }
        }
        
        res.json({
            message: '背景图片上传成功',
            backgroundUrl
        });
    } catch (error) {
        console.error('上传背景图片失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 重置背景图片
exports.resetBackground = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 获取用户当前的背景图片URL
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl']
        });
        const oldBackgroundUrl = user?.backgroundUrl;

        // 更新用户背景图片URL为默认值
        const [updatedRowsCount] = await User.update(
            { backgroundUrl: '/api/userdata/background/wp.jpg' },
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 删除旧的背景图片文件（如果存在且不是默认背景）
        if (oldBackgroundUrl && !oldBackgroundUrl.includes('wp.jpg')) {
            const oldBackgroundPath = path.join(__dirname, '..', 'public', oldBackgroundUrl);
            if (fs.existsSync(oldBackgroundPath)) {
                fs.unlinkSync(oldBackgroundPath);
            }
        }
    } catch (error) {
        console.error('重置背景图片错误:', error);
        res.status(500).json({ error: '重置背景图片失败' });
    }
};
