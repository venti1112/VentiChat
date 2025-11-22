const models = require('../models');
const { Sequelize } = require('sequelize');

const { RoomMember, Room, Message, User } = models;

// 计算用户的总未读消息数（私有方法）
const calculateTotalUnreadCount = async (userId) => {
    // 使用联表查询和聚合函数一次性计算总未读数
    // 先获取用户加入的所有聊天室
    const roomMembers = await RoomMember.findAll({
        where: { userId: userId },
        attributes: ['roomId', 'lastReadMessageId']
    });

    if (roomMembers.length === 0) return 0;

    // 构建查询条件：统计每个聊天室中未读消息数
    const unreadPromises = roomMembers.map(async (member) => {
        const unreadCount = await Message.count({
            where: {
                roomId: member.roomId,
                id: {
                    [Sequelize.Op.gt]: member.lastReadMessageId || 0
                }
            }
        });
        return unreadCount;
    });

    const unreadCounts = await Promise.all(unreadPromises);
    return unreadCounts.reduce((sum, count) => sum + count, 0);
};

// 发送消息
exports.sendMessage = async (req, res) => {
    try {
        const { roomId, content, type, fileUrl } = req.body;
        
        // 检查用户是否在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { 
                userId: req.user.id, 
                roomId 
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 检查文件权限（如果是文件消息）
        if (type !== 'text' && type !== 'image' && type !== 'video' && type !== 'file') {
            return res.status(400).json({ error: '无效的消息类型' });
        }
        
        if (fileUrl) {
            const room = await Room.findByPk(roomId);
            const allowField = `allow${type.charAt(0).toUpperCase() + type.slice(1)}s`;
            if (!room[allowField]) {
                return res.status(403).json({ error: `该聊天室不允许发送${type}` });
            }
        }
        
        // 创建消息
        const message = await Message.create({
            senderId: req.user.id,
            roomId,
            content,
            type,
            fileUrl
        });
        
        // 更新发送者在该聊天室的最后阅读消息ID
        await RoomMember.update(
            { lastReadMessageId: message.id },
            { where: { userId: req.user.id, roomId } }
        );
        
        // 通过Socket.IO广播消息
        const io = req.app.get('io');
        io.to(`room_${roomId}`).emit('newMessage', message);
        
        // 实时推送未读计数更新
        const totalUnreadCount = await calculateTotalUnreadCount(req.user.id);
        const userSocketMap = req.app.get('userSocketMap');
        if (userSocketMap) {
            const socketId = userSocketMap.get(req.user.id);
            if (socketId) {
                io.to(socketId).emit('unreadCountUpdate', { count: totalUnreadCount });
            }
        }
        
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 撤回消息
exports.recallMessage = async (req, res) => {
    try {
        const { id } = req.params;
        
        const message = await Message.findByPk(id);
        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }
        
        // 检查是否是消息发送者（只有发送者可以撤回）
        if (message.senderId !== req.user.id) {
            return res.status(403).json({ error: '只能撤回自己的消息' });
        }
        
        // 检查消息发送时间（超过2分钟不能撤回）
        const now = new Date();
        const messageTime = new Date(message.createdAt);
        const timeDiff = (now - messageTime) / 1000 / 60; // 转换为分钟
        
        if (timeDiff > 2) {
            return res.status(400).json({ error: '消息发送超过2分钟，无法撤回' });
        }
        
        // 更新消息内容为"已撤回"
        await message.update({
            content: '[已撤回]',
            type: 'recall'
        });
        
        // 通过Socket.IO广播撤回消息事件
        const io = req.app.get('io');
        io.to(`room_${message.roomId}`).emit('messageRecalled', { messageId: id });
        
        res.json({ message: '消息已撤回' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室消息
exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        // 确保roomId是数字类型
        const roomIdInt = parseInt(roomId);
        if (isNaN(roomIdInt)) {
            return res.status(400).json({ error: '无效的聊天室ID' });
        }
        
        // 检查用户是否在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { 
                userId: req.user.id, 
                roomId: roomIdInt 
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        const messages = await Message.findAndCountAll({
            where: { roomId: roomIdInt },
            include: [{
                model: User,
                attributes: ['nickname', 'avatarUrl']
            }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });
        
        res.json({
            messages: messages.rows,
            total: messages.count,
            page: parseInt(page),
            pages: Math.ceil(messages.count / parseInt(limit))
        });
    } catch (error) {
        console.error('获取聊天室消息错误:', error);
        res.status(500).json({ error: error.message });
    }
};

// 获取消息历史
exports.getMessageHistory = async (req, res) => {
    try {
        const { roomId } = req.params;  // 从路径参数获取roomId
        const { before } = req.query;
        const limit = 50; // 每次获取50条消息
        
        // 确保roomId是数字类型
        const roomIdInt = parseInt(roomId);
        if (isNaN(roomIdInt) || roomIdInt <= 0) {
            return res.status(400).json({ error: '无效的聊天室ID' });
        }
        
        // 检查用户是否在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { 
                userId: req.user.id, 
                roomId: roomIdInt 
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 构建查询条件
        const whereClause = { roomId: roomIdInt };
        if (before) {
            const beforeInt = parseInt(before);
            if (!isNaN(beforeInt)) {
                whereClause.id = { [Sequelize.Op.lt]: beforeInt };
            }
        }
        
        // 获取消息历史
        const messages = await Message.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            limit: limit,
            include: [{
                model: User,
                as: 'Sender',
                attributes: ['id', 'username', 'nickname', 'avatarUrl']
            }]
        });
        
        res.json(messages.reverse()); // 按时间顺序返回
    } catch (error) {
        console.error('获取消息历史错误:', error);
        res.status(500).json({ error: error.message });
    }
};

// 获取未读消息数
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 计算总未读消息数
        const totalUnreadCount = await calculateTotalUnreadCount(userId);
        
        res.json({ count: totalUnreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取特定聊天室的未读消息数
exports.getRoomUnreadCount = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查用户是否在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.id, roomId: id }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取聊天室最后一条消息
        const lastMessage = await Message.findOne({
            where: { roomId: id },
            order: [['id', 'DESC']],
            attributes: ['id']
        });
        
        if (!lastMessage) {
            return res.json({ unreadCount: 0 });
        }
        
        const unreadCount = lastMessage.id > roomMember.lastReadMessageId ? 1 : 0;
        res.json({ unreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 标记消息已读
exports.markAsRead = async (req, res) => {
    try {
        const { roomId } = req.body;
        const userId = req.user.id;
        
        // 检查用户是否在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId, roomId }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取聊天室最新消息ID
        const latestMessage = await Message.findOne({
            where: { roomId },
            order: [['id', 'DESC']],
            attributes: ['id']
        });
        
        if (!latestMessage) {
            return res.json({ message: '没有消息需要标记为已读' });
        }
        
        // 更新用户在该聊天室的最后阅读消息ID
        await RoomMember.update(
            { lastReadMessageId: latestMessage.id },
            { where: { userId, roomId } }
        );
        
        // 计算新的总未读消息数
        const totalUnreadCount = await calculateTotalUnreadCount(userId);
        
        // 通过Socket.IO推送未读计数更新
        const io = req.app.get('io');
        const userSocketMap = req.app.get('userSocketMap');
        if (userSocketMap) {
            const socketId = userSocketMap.get(userId);
            if (socketId) {
                io.to(socketId).emit('unreadCountUpdate', { count: totalUnreadCount });
            }
        }
        
        res.json({ 
            message: '标记已读成功',
            totalUnreadCount 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};














