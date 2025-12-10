const models = require('../models');
const { log } = require('../utils/logger');
const bcrypt = require('bcrypt');

// 获取所有用户（管理员）
exports.getUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['userId', 'username', 'nickname', 'status', 'createdAt', 'isAdmin']
        });
        
        // 格式化返回数据，确保字段名与前端一致，并简化状态信息
        const formattedUsers = users.map(user => ({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            status: user.status, // 直接使用字符串状态
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        }));
        
        res.json(formattedUsers);
    } catch (error) {
        log('ERROR', `获取用户列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取单个用户信息（管理员）
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 查找用户
        const user = await models.User.findByPk(userId, {
            attributes: ['userId', 'username', 'nickname', 'status', 'isAdmin']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 格式化返回数据
        const formattedUser = {
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            status: user.status,
            isAdmin: user.isAdmin
        };
        
        res.json(formattedUser);
    } catch (error) {
        log('ERROR', `获取用户信息失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 创建用户（管理员）
exports.createUser = async (req, res) => {
    try {
        const { username, nickname, password, status, isAdmin } = req.body;
        
        // 检查用户名是否已存在
        const existingUser = await models.User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 密码加密
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // 创建用户
        const user = await models.User.create({
            username,
            nickname,
            passwordHash,
            status: typeof status !== 'undefined' ? status : 'active',
            isAdmin: isAdmin || false
        });
        
        res.status(201).json({ 
            message: '用户创建成功',
            user: {
                id: user.userId,
                username: user.username,
                nickname: user.nickname,
                status: user.status,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        log('ERROR', `创建用户失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 更新用户信息（管理员）
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, nickname, status, isAdmin } = req.body;
        
        // 查找用户
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 更新用户信息
        await user.update({
            username,
            nickname,
            status,
            isAdmin
        });
        
        res.json({ message: '用户信息更新成功' });
    } catch (error) {
        log('ERROR', `更新用户信息失败: ${error.message}`);
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
        log('ERROR', `删除用户失败: ${error.message}`);
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
        log('ERROR', `更新用户状态失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取所有聊天室（管理员）
exports.getRooms = async (req, res) => {
    try {
        const rooms = await models.Room.findAll();
        
        // 获取所有唯一的创建者ID
        const creatorIds = [...new Set(rooms.map(room => room.creatorId))];
        
        // 批量获取创建者信息
        const creators = await models.User.findAll({
            where: {
                userId: {
                    [models.Sequelize.Op.in]: creatorIds
                }
            },
            attributes: ['userId', 'username']
        });
        
        // 创建ID到用户名的映射
        const creatorMap = {};
        creators.forEach(creator => {
            creatorMap[creator.userId] = creator.username;
        });
        
        // 为每个房间添加成员数量和创建者用户名
        const roomsWithDetails = await Promise.all(rooms.map(async (room) => {
            const memberCount = await models.RoomMember.count({
                where: { roomId: room.roomId }
            });
            
            return {
                ...room.toJSON(),
                memberCount: memberCount,
                creatorName: creatorMap[room.creatorId] || '未知用户'
            };
        }));
        
        res.json(roomsWithDetails);
    } catch (error) {
        log('ERROR', `获取聊天室列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（管理员）
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查找房间
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 删除房间及相关数据
        await room.destroy();
        
        res.json({ message: '聊天室删除成功' });
    } catch (error) {
        log('ERROR', `删除聊天室失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

/**
 * 获取聊天室统计数据
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getRoomStatistics = async (req, res) => {
    try {
        // 获取公共和私人聊天室的数量
        const publicRoomsCount = await models.Room.count({
            where: { isPrivate: false }
        });
        
        const privateRoomsCount = await models.Room.count({
            where: { isPrivate: true }
        });
        
        // 计算最大成员数
        const rooms = await models.Room.findAll({
            attributes: ['roomId']
        });
        
        let maxMembers = 0;
        if (rooms.length > 0) {
            // 使用 Promise.all 并行计算每个房间的成员数
            const memberCounts = await Promise.all(
                rooms.map(room => models.RoomMember.count({ where: { roomId: room.roomId } }))
            );
            
            // 找到最大成员数
            maxMembers = Math.max(...memberCounts);
        }
        
        // 查找最活跃的聊天室（基于消息数量）
        const roomMessageCounts = await models.Message.findAll({
            attributes: [
                'roomId',
                [models.sequelize.fn('COUNT', models.sequelize.col('message_id')), 'messageCount']
            ],
            group: ['roomId'],
            order: [[models.sequelize.fn('COUNT', models.sequelize.col('message_id')), 'DESC']],
            limit: 1
        });
        
        let mostActiveRoom = null;
        if (roomMessageCounts.length > 0) {
            const roomId = roomMessageCounts[0].roomId;
            const room = await models.Room.findByPk(roomId, {
                attributes: ['name']
            });
            if (room) {
                mostActiveRoom = {
                    name: room.name,
                    messageCount: roomMessageCounts[0].toJSON().messageCount
                };
            }
        }
        
        res.json({
            totalPublicRooms: publicRoomsCount,
            totalPrivateRooms: privateRoomsCount,
            maxMembersInRoom: maxMembers,
            mostActiveRoom: mostActiveRoom
        });
    } catch (error) {
        log('ERROR', `获取聊天室统计数据失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};
