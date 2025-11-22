const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Room = require('../models/room');
const RoomMember = require('../models/roomMember');
const { Sequelize } = require('sequelize');
const { getAvatarUrl } = require('../utils/fileUpload');

// 用户登录
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
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
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
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
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'nickname', 'avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 用户注册
exports.register = async (req, res) => {
    try {
        const { username, password, nickname } = req.body;
        
        // 检查用户名是否已存在
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
                userId: user.id,
                roomId: defaultRoom.id
            });
            
            // 更新房间的成员列表
            const currentMembers = defaultRoom.members || [];
            if (!currentMembers.includes(user.id)) {
                currentMembers.push(user.id);
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
                where: { id: req.user.id }
            }
        );
        
        // 获取更新后的用户信息
        const updatedUser = await User.findByPk(req.user.id);
        
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
        
        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { username: { [Sequelize.Op.like]: `%${query}%` } },
                    { nickname: { [Sequelize.Op.like]: `%${query}%` } }
                ]
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl']
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
        const targetUserId = userId || req.user.id;
        
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