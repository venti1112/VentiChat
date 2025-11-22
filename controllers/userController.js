const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Room = require('../models/room');
const RoomMember = require('../models/roomMember');
const { Sequelize } = require('sequelize');
const { getAvatarUrl } = require('../utils/fileUpload');

// 用户登录
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const User = req.app.get('models').User;
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
            { id: user.userId, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        const defaultRoom = await Room.findOne({ where: { name: 'VentiChat大厅' } });
        if (defaultRoom) {
            await RoomMember.create({
                userId: user.userId,
                roomId: defaultRoom.roomId
            });
            
            // 更新房间的成员列表
            const currentMembers = defaultRoom.members || [];
            if (!currentMembers.includes(user.userId)) {
                currentMembers.push(user.userId);
                await defaultRoom.update({ members: currentMembers });
            }
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
        
        await User.update(
            updateData,
            {
                where: { userId: req.user.userId }
            }
        );
        
        // 获取更新后的用户信息
        const updatedUser = await User.findByPk(req.user.userId);
        
        res.json({ 
            message: '资料更新成功',
            user: updatedUser
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
        
        // 构造背景图片URL
        const backgroundUrl = `/userdata/backgrounds/${req.file.filename}`;
        
        // 更新用户背景图片URL
        const User = req.app.get('models').User;
        const [updatedRowsCount] = await User.update(
            { backgroundUrl },
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
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
        
        // 更新用户背景图片URL为默认值
        const User = req.app.get('models').User;
        const [updatedRowsCount] = await User.update(
            { backgroundUrl: '/wp.jpg' },
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
            message: '背景图片重置成功',
            preferences: {
                backgroundUrl: updatedUser.backgroundUrl || '/wp.jpg',
                themeColor: updatedUser.themeColor || '#4cd8b8'
            }
        });
    } catch (error) {
        console.error('重置背景图片失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};
