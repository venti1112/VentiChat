const models = require('../models');

// 获取所有用户（管理员）
exports.getUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['id', 'username', 'nickname', 'status', 'created_at']
        });
        
        // 格式化返回数据，确保字段名与前端一致
        const formattedUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            status: user.status,
            createdAt: user.created_at,
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
        
        res.json({ message: '用户创建成功', user: { id: user.id, username: user.username, nickname: user.nickname } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户（管理员）
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { nickname, status } = req.body;
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.update({ nickname, status });
        
        res.json({ message: '用户信息已更新' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除用户（管理员）
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.destroy();
        
        res.json({ message: '用户已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 封禁/解封用户（管理员）
exports.toggleUserStatus = async (req, res) => {
    try {
        const { userId, action } = req.body; // action: 'ban' or 'unban'
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.update({
            status: action === 'ban' ? 'banned' : 'active'
        });
        
        res.json({ message: `用户已${action === 'ban' ? '封禁' : '解封'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户状态（管理员）- 用于处理前端PUT /api/admin/users/:userId/status请求
exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.update({ status });
        
        const action = status === 'banned' ? '封禁' : '解封';
        res.json({ message: `用户已${action}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取所有聊天室（管理员）
exports.getRooms = async (req, res) => {
    try {
        const rooms = await models.Room.findAll({
            attributes: ['id', 'name', 'created_at', 'retention_days', 'creatorId']
        });
        
        // 获取所有房间的成员数量
        const roomMembers = await models.RoomMember.findAll({
            attributes: ['room_id'],
            raw: true
        });
        
        // 统计每个房间的成员数量
        const memberCounts = {};
        roomMembers.forEach(member => {
            if (!memberCounts[member.room_id]) {
                memberCounts[member.room_id] = 0;
            }
            memberCounts[member.room_id]++;
        });
        
        // 获取所有创建者信息
        const creatorIds = [...new Set(rooms.map(room => room.creatorId))];
        const creators = await models.User.findAll({
            attributes: ['id', 'nickname'],
            where: {
                id: creatorIds
            },
            raw: true
        });
        
        const creatorMap = {};
        creators.forEach(creator => {
            creatorMap[creator.id] = creator;
        });
        
        // 格式化返回数据
        const formattedRooms = rooms.map(room => ({
            id: room.id,
            name: room.name,
            creator: creatorMap[room.creatorId] || null,
            memberCount: memberCounts[room.id] || 0,
            createdAt: room.created_at,
            retentionDays: room.retention_days || 180,
            // 添加一个默认的messageCount字段，避免前端出错
            messageCount: 0
        }));
        
        res.json(formattedRooms);
    } catch (error) {
        console.error('获取房间列表失败:', error);
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（管理员）
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        await room.destroy();
        
        res.json({ message: '聊天室已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取特定聊天室详情（管理员）
exports.getRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        const room = await models.Room.findByPk(id, {
            attributes: ['id', 'name', 'created_at', 'retention_days', 'creatorId']
        });
        
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 获取房间成员数量
        const memberCount = await models.RoomMember.count({
            where: { room_id: id }
        });
        
        // 获取创建者信息
        const creator = await models.User.findByPk(room.creatorId, {
            attributes: ['id', 'nickname']
        });
        
        // 获取消息数量
        const messageCount = await models.Message.count({
            where: { roomId: id }
        });
        
        // 格式化返回数据
        const formattedRoom = {
            id: room.id,
            name: room.name,
            creator: creator ? {
                id: creator.id,
                nickname: creator.nickname
            } : null,
            memberCount: memberCount,
            messageCount: messageCount,
            createdAt: room.created_at,
            retentionDays: room.retention_days || 180
        };
        
        res.json(formattedRoom);
    } catch (error) {
        console.error('获取房间详情失败:', error);
        res.status(500).json({ error: error.message });
    }
};

// 获取房间成员列表（管理员）
exports.getRoomMembers = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 验证房间是否存在
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 获取房间成员列表
        const members = await models.RoomMember.findAll({
            where: { room_id: id },
            raw: true // 使用raw查询避免Sequelize添加额外字段
        });
        
        // 获取用户信息
        const userIds = members.map(member => member.user_id);
        const users = await models.User.findAll({
            where: {
                id: userIds
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl', 'status'],
            raw: true
        });
        
        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user;
        });
        
        // 格式化返回数据
        const formattedMembers = members.map(member => {
            const user = userMap[member.user_id];
            return {
                id: user ? user.id : null,
                username: user ? user.username : null,
                nickname: user ? user.nickname : null,
                avatarUrl: user ? (user.avatarUrl || '/default-avatar.png') : '/default-avatar.png',
                status: user ? user.status : null,
                isModerator: member.is_moderator,
                note: member.note,
                joinTime: member.join_time
            };
        });
        
        res.json(formattedMembers);
    } catch (error) {
        console.error('获取房间成员列表失败:', error);
        res.status(500).json({ error: error.message });
    }
};
