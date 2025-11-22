const { models } = require('../models');
const { log, LOG_LEVELS } = require('../utils/logger');

// 获取所有用户（管理员）
exports.getUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['userId', 'username', 'nickname', 'status', 'createdAt']
        });
        
        // 格式化返回数据，确保字段名与前端一致
        const formattedUsers = users.map(user => ({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            status: user.status,
            createdAt: user.createdAt,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        }));
        
        res.json(formattedUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 创建用户（管理员）
exports.createUser = async (req, res) => {
    try {
        const { username, nickname, password } = req.body;
        
        // 检查用户名是否已存在
        const existingUser = await models.User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 密码加密
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // 创建用户
        const user = await models.User.create({
            username,
            nickname,
            passwordHash
        });
        
        res.json({ message: '用户创建成功', user: { id: user.userId, username: user.username, nickname: user.nickname } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户信息（管理员）
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, nickname, status } = req.body;
        
        // 查找用户
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 更新用户信息
        await user.update({
            username,
            nickname,
            status
        });
        
        res.json({ message: '用户信息更新成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除用户（管理员）
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 检查用户是否存在
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 删除用户
        await models.User.destroy({
            where: { userId }
        });
        
        res.json({ message: '用户删除成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户状态（管理员）
exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        
        // 检查用户是否存在
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 更新用户状态
        await user.update({ status });
        
        res.json({ message: '用户状态更新成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取所有聊天室（管理员）
exports.getRooms = async (req, res) => {
    try {
        const rooms = await models.Room.findAll();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室详情（管理员）
exports.getRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员（管理员）
exports.getRoomMembers = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 获取房间成员
        const roomMembers = await models.RoomMember.findAll({
            where: { roomId: id },
            include: [{
                model: models.User,
                attributes: ['userId', 'username', 'nickname', 'avatarUrl']
            }]
        });
        
        // 格式化成员信息
        const members = roomMembers.map(rm => ({
            uid: rm.User.userId,
            username: rm.User.username,
            nickname: rm.User.nickname,
            avatarUrl: rm.User.avatarUrl,
            isModerator: rm.isModerator
        }));
        
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（管理员）
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 删除聊天室相关数据
        await models.RoomMember.destroy({ where: { roomId: id } });
        await models.Message.destroy({ where: { roomId: id } });
        await models.JoinRequest.destroy({ where: { roomId: id } });
        
        // 删除聊天室
        const result = await models.Room.destroy({ where: { roomId: id } });
        if (result === 0) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        res.json({ message: '聊天室删除成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};