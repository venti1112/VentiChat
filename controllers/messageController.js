const models = require('../models');
const { Sequelize } = require('sequelize');

const { RoomMember, Room, Message, User } = models;

// 计算用户的总未读消息数
const calculateTotalUnreadCount = async (userId) => {
    // 获取用户加入的所有聊天室
    const roomMembers = await RoomMember.findAll({
        where: { userId: userId },
        attributes: ['roomId', 'lastReadMessageId']
    });

    if (roomMembers.length === 0) return 0;

    // 统计每个聊天室中未读消息数
    const unreadPromises = roomMembers.map(async (member) => {
        return await Message.count({
            where: {
                roomId: member.roomId,
                messageId: {
                    [Sequelize.Op.gt]: member.lastReadMessageId || 0
                }
            }
        });
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
                userId: req.user.userId, 
                roomId 
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 验证消息类型
        if (!['text', 'image', 'video', 'file'].includes(type)) {
            return res.status(400).json({ error: '无效的消息类型' });
        }
        
        // 检查文件权限（如果是文件消息）
        if (type === 'image' || type === 'video' || type === 'file') {
            const room = await Room.findByPk(roomId);
            if (!room) {
                return res.status(404).json({ error: '聊天室不存在' });
            }
            
            if (type === 'image' && !room.allowImages) {
                return res.status(403).json({ error: '该聊天室不允许发送图片' });
            }
            
            if (type === 'video' && !room.allowVideos) {
                return res.status(403).json({ error: '该聊天室不允许发送视频' });
            }
            
            if (type === 'file' && !room.allowFiles) {
                return res.status(403).json({ error: '该聊天室不允许发送文件' });
            }
        }
        
        // 创建消息
        const message = await Message.create({
            messageId: null, // 数据库会自动生成
            userId: req.user.userId,
            roomId,
            content: content || null,
            type: type || 'text',
            fileUrl: fileUrl || null,
            sentAt: new Date()
        });
        
        // 更新用户在该房间的最后阅读消息ID
        await RoomMember.update(
            { lastReadMessageId: message.messageId },
            { 
                where: { 
                    userId: req.user.userId, 
                    roomId 
                } 
            }
        );
        
        // 通过Socket.IO广播消息
        const io = req.app.get('io');
        
        // 获取发送者信息
        const sender = await User.findByPk(req.user.userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        // 组装包含发送者信息的消息对象
        const messageData = message.toJSON();
        const messageWithSender = {
            ...messageData,
            Sender: sender
        };
        
        // 广播消息到房间
        io.to(`room_${roomId}`).emit('newMessage', messageWithSender);
        
        // 实时推送未读计数更新
        const totalUnreadCount = await calculateTotalUnreadCount(req.user.userId);
        const userSocketMap = req.app.get('userSocketMap');
        if (userSocketMap) {
            const socketId = userSocketMap.get(req.user.userId);
            if (socketId) {
                io.to(socketId).emit('unreadCountUpdate', { count: totalUnreadCount });
            }
        }
        
        // 返回消息对象，确保包含id字段
        res.json(messageWithSender);
    } catch (error) {
        console.error('发送消息错误:', error);
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
        if (message.userId !== req.user.userId) {
            return res.status(403).json({ error: '您只能撤回自己的消息' });
        }
        
        // 检查消息发送时间（超过5分钟不能撤回）
        const now = new Date();
        const sentTime = new Date(message.sentAt);
        if (now - sentTime > 300000) { // 5分钟 = 300000毫秒
            return res.status(400).json({ error: '消息发送超过5分钟，无法撤回' });
        }
        
        // 更新消息内容为"[已撤回]"
        await message.update({
            content: '[已撤回]',
            isDeleted: true,
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

// 获取未读消息数
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;
        
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
            where: { userId: req.user.userId, roomId: id }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取聊天室最后一条消息
        const lastMessage = await Message.findOne({
            where: { roomId: id },
            order: [['messageId', 'DESC']],
            attributes: ['messageId']
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
        const userId = req.user.userId;
        
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
            order: [['messageId', 'DESC']],
            attributes: ['messageId']
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

// 获取聊天室消息历史
exports.getMessageHistory = async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // 检查用户是否是聊天室成员
        const roomMember = await RoomMember.findOne({
            where: {
                userId: req.user.userId,
                roomId
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取消息历史（最近50条）
        const messages = await Message.findAll({
            where: { roomId },
            order: [['sentAt', 'DESC']],
            limit: 50
        });
        
        // 获取涉及的用户ID列表
        const userIds = [...new Set(messages.map(msg => msg.userId))];
        
        // 获取用户信息
        const users = await User.findAll({
            where: {
                userId: userIds
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        // 创建用户信息映射
        const userMap = {};
        users.forEach(user => {
            userMap[user.userId] = user;
        });
        
        // 将用户信息附加到消息中
        const messagesWithUsers = messages.map(message => ({
            ...message.toJSON(),
            User: userMap[message.userId]
        }));
        
        // 反转消息顺序，使最新消息在最后
        const sortedMessages = messagesWithUsers.reverse();
        
        res.json(sortedMessages);
    } catch (error) {
        console.error('获取消息历史错误:', error);
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室消息（分页）
exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { before } = req.query; // 可选的分页参数
        
        // 检查用户是否是聊天室成员
        const roomMember = await RoomMember.findOne({
            where: {
                userId: req.user.userId,
                roomId
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 构建查询条件
        const whereClause = { roomId };
        if (before) {
            whereClause.sentAt = {
                [Sequelize.Op.lt]: new Date(parseInt(before))
            };
        }
        
        // 获取消息（最近30条）
        const messages = await Message.findAll({
            where: whereClause,
            order: [['sentAt', 'DESC']],
            limit: 30
        });
        
        // 反转消息顺序，使最新消息在最后
        const sortedMessages = messages.reverse();
        
        res.json(sortedMessages);
    } catch (error) {
        console.error('获取聊天室消息错误:', error);
        res.status(500).json({ error: error.message });
    }
};









