const Message = require('../models/message');
const RoomMember = require('../models/roomMember');
const User = require('../models/user');
const Room = require('../models/room');
const { Sequelize } = require('sequelize');

// 计算用户的总未读消息数（私有方法）
const calculateTotalUnreadCount = async (userId) => {
    // 获取用户加入的所有聊天室及其最后阅读的消息ID
    const roomMembers = await RoomMember.findAll({
        where: { userId },
        attributes: ['roomId', 'lastReadMessageId']
    });

    if (roomMembers.length === 0) return 0;

    // 构建查询条件：每个聊天室的最后一条消息ID > 用户最后阅读的ID
    const promises = roomMembers.map(async (member) => {
        const lastMessage = await Message.findOne({
            where: { roomId: member.roomId },
            order: [['id', 'DESC']],
            attributes: ['id']
        });
        
        if (!lastMessage) return 0;
        return lastMessage.id > member.lastReadMessageId ? 1 : 0;
    });

    const unreadCounts = await Promise.all(promises);
    return unreadCounts.reduce((sum, count) => sum + count, 0);
};

// 发送消息
exports.sendMessage = async (req, res) => {
    try {
        const { roomId, content, type, fileUrl } = req.body;
        
        // 检查用户是否在聊天室中
        const roomMember = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 检查文件权限（如果是文件消息）
        if (type !== 'text' && type !== 'image' && type !== 'video' && type !== 'file') {
            return res.status(400).json({ error: '无效的消息类型' });
        }
        
        if (fileUrl) {
            const room = await models.Room.findByPk(roomId);
            const allowField = `allow${type.charAt(0).toUpperCase() + type.slice(1)}s`;
            if (!room[allowField]) {
                return res.status(403).json({ error: `该聊天室不允许发送${type}` });
            }
        }
        
        // 创建消息
        const message = await models.Message.create({
            senderId: req.user.id,
            roomId,
            content,
            type,
            fileUrl
        });
        
        // 更新发送者在该聊天室的最后阅读消息ID
        await models.RoomMember.update(
            { lastReadMessageId: message.id },
            { where: { userId: req.user.id, roomId } }
        );
        
        // 通过Socket.IO广播消息
        req.app.get('io').to(`room_${roomId}`).emit('newMessage', message);
        
        // 实时推送未读计数更新
        const totalUnreadCount = await calculateTotalUnreadCount(req.user.id);
        const userSocketMap = req.app.get('userSocketMap');
        const socketId = userSocketMap.get(req.user.id);
        if (socketId) {
            req.app.get('io').to(socketId).emit('unreadCountUpdate', { count: totalUnreadCount });
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
        
        const message = await models.Message.findByPk(id);
        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }
        
        // 检查是否是消息发送者且在10分钟内
        if (message.senderId !== req.user.id) {
            return res.status(403).json({ error: '只能撤回自己的消息' });
        }
        
        const tenMinutes = 10 * 60 * 1000;
        const now = new Date().getTime();
        const messageTime = new Date(message.sent_at).getTime();
        
        if (now - messageTime > tenMinutes) {
            return res.status(403).json({ error: '消息已超过10分钟，无法撤回' });
        }
        
        // 撤回消息
        await message.update({ isDeleted: true });
        
        // 广播撤回消息
        req.app.get('io').to(`room_${message.roomId}`).emit('messageRecalled', { messageId: id });
        
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
        
        // 检查用户是否在聊天室中
        const roomMember = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        const messages = await Message.findAndCountAll({
            where: { roomId },
            include: [{
                model: models.User,
                attributes: ['nickname', 'avatarUrl']
            }],
            order: [['sent_at', 'DESC']],
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
        res.status(500).json({ error: error.message });
    }
};

// 获取用户的总未读消息数
exports.getUnreadCount = async (req, res) => {
    try {
        // 获取用户加入的所有聊天室及其最后阅读的消息ID
        const roomMembers = await models.RoomMember.findAll({
            where: { userId: req.user.id },
            attributes: ['roomId', 'lastReadMessageId']
        });

        if (roomMembers.length === 0) {
            return res.json({ unreadCount: 0 });
        }

        // 构建查询条件：每个聊天室的最后一条消息ID > 用户最后阅读的ID
        const promises = roomMembers.map(async (member) => {
            const lastMessage = await models.Message.findOne({
                where: { roomId: member.roomId },
                order: [['id', 'DESC']],
                attributes: ['id']
            });
            
            if (!lastMessage) return 0;
            return lastMessage.id > member.lastReadMessageId ? 1 : 0;
        });

        const unreadCounts = await Promise.all(promises);
        const totalUnreadCount = unreadCounts.reduce((sum, count) => sum + count, 0);
        
        res.json({ unreadCount: totalUnreadCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取特定聊天室的未读消息数
exports.getRoomUnreadCount = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查用户是否在聊天室中
        const roomMember = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId: id }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取聊天室最后一条消息
        const lastMessage = await models.Message.findOne({
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

// 标记聊天室为已读
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查用户是否在聊天室中
        const roomMember = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId: id }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取聊天室最后一条消息
        const lastMessage = await models.Message.findOne({
            where: { roomId: id },
            order: [['id', 'DESC']],
            attributes: ['id']
        });
        
        if (lastMessage) {
            // 更新最后阅读消息ID
            await roomMember.update({ lastReadMessageId: lastMessage.id });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};










