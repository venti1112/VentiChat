const { Message, Room, User } = require('../app');
const { getFileUrl } = require('./fileUpload');
const { log } = require('./logger'); // 引入日志方法

// 发送消息
const sendMessage = async (data) => {
    try {
        // 验证用户是否有权限发送消息到该聊天室
        const roomMember = await RoomMember.findOne({
            where: {
                userId: data.senderId,
                roomId: data.roomId
            }
        });
        
        if (!roomMember) {
            throw new Error('您不是该聊天室的成员');
        }
        
        // 获取聊天室设置
        const room = await Room.findByPk(data.roomId);
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 创建消息
        const message = await Message.create({
            roomId: data.roomId,
            senderId: data.senderId,
            content: data.content,
            type: data.type || 'text',
            fileUrl: data.fileUrl
        });
        
        // 获取发送者信息
        const sender = await User.findByPk(data.senderId);
        
        // 返回完整的消息对象
        return {
            id: message.id,
            roomId: message.roomId,
            senderId: message.senderId,
            nickname: sender.nickname,
            avatarUrl: sender.avatarUrl,
            content: message.content,
            type: message.type,
            fileUrl: message.fileUrl,
            sentAt: message.sentAt,
            isDeleted: message.isDeleted
        };
    } catch (error) {
        log('ERROR', `发送消息失败: ${error.message}`);
        throw error;
    }
};

// 撤回消息
const retractMessage = async (messageId, userId) => {
    try {
        const message = await Message.findByPk(messageId);
        
        if (!message) {
            throw new Error('消息不存在');
        }
        
        // 检查是否是消息发送者
        if (message.senderId !== userId) {
            throw new Error('只能撤回自己发送的消息');
        }
        
        // 检查是否在10分钟内
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (message.sentAt < tenMinutesAgo) {
            throw new Error('消息已超过10分钟，无法撤回');
        }
        
        // 更新消息状态
        message.isDeleted = true;
        await message.save();
        
        return { success: true };
    } catch (error) {
        log('ERROR', `撤回消息失败: ${error.message}`);
        throw error;
    }
};

// 获取历史消息
const getHistoryMessages = async (roomId, limit = 50, offset = 0) => {
    try {
        const messages = await Message.findAndCountAll({
            where: { roomId: roomId, isDeleted: false },
            include: [
                { model: User, as: 'Sender', attributes: ['nickname', 'avatarUrl'] }
            ],
            order: [['sentAt', 'DESC']],
            limit: limit,
            offset: offset
        });
        
        // 转换为前端需要的格式
        const formattedMessages = messages.rows.map(msg => ({
            id: msg.id,
            roomId: msg.roomId,
            senderId: msg.senderId,
            nickname: msg.Sender.nickname,
            avatarUrl: msg.Sender.avatarUrl,
            content: msg.content,
            type: msg.type,
            fileUrl: msg.fileUrl,
            sentAt: msg.sentAt,
            isDeleted: msg.isDeleted
        }));
        
        return {
            messages: formattedMessages.reverse(), // 前端需要按时间顺序显示
            total: messages.count,
            hasMore: offset + limit < messages.count
        };
    } catch (error) {
        log('ERROR', `获取历史消息失败: ${error.message}`);
        throw error;
    }
};

// 获取未读消息数
const getUnreadCount = async (userId, roomId = null) => {
    try {
        const where = { isDeleted: false };
        
        if (roomId) {
            where.roomId = roomId;
            // 这里需要更复杂的逻辑来确定未读消息
            // 简化实现：返回最近10条消息的数量
            const latestMessage = await Message.findOne({
                where: { roomId: roomId },
                order: [['sentAt', 'DESC']]
            });
            
            if (latestMessage) {
                // 假设用户最后阅读的消息ID存储在某个地方
                // 这里简化为返回固定数量
                return 5;
            }
        } else {
            // 获取所有聊天室的未读消息总数
            return 15;
        }
        
        return 0;
    } catch (error) {
        log('ERROR', `获取未读消息数失败: ${error.message}`);
        throw error;
    }
};

module.exports = {
    sendMessage,
    retractMessage,
    getHistoryMessages,
    getUnreadCount
};

