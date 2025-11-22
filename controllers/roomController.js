const { Op } = require('sequelize');
const models = require('../models');
const { log } = require('../utils/logger');

// 创建聊天室
exports.createRoom = async (req, res) => {
    try {
        const { name, isPrivate, requireApproval, allowImages, allowVideos, allowFiles, retentionDays } = req.body;
        
        // 记录创建聊天室的尝试
        log('INFO', `用户 ${req.user.username}(ID: ${req.user.id}) 正在创建聊天室: ${name}`);

        // 创建聊天室
        const room = await models.Room.create({
            name,
            creatorId: req.user.id,  // 使用模型属性名
            isPrivate: isPrivate || false,
            requireApproval: requireApproval !== undefined ? requireApproval : true,
            allowImages: allowImages !== undefined ? allowImages : true,
            allowVideos: allowVideos !== undefined ? allowVideos : true,
            allowFiles: allowFiles !== undefined ? allowFiles : true,
            retentionDays: retentionDays || 180,
            members: [req.user.id]  // 将创建者添加到成员列表中
        });

        // 将创建者加入聊天室并设为室主
        await models.RoomMember.create({
            userId: req.user.id,  // 使用模型属性名
            roomId: room.id,      // 使用模型属性名
            isModerator: true     // 使用模型属性名
        });

        // 记录聊天室创建成功
        log('INFO', `用户 ${req.user.username}(ID: ${req.user.id}) 成功创建聊天室: ${name}(ID: ${room.id})`);

        res.json(room);
    } catch (error) {
        // 记录创建聊天室失败
        log('ERROR', `用户 ${req.user.username}(ID: ${req.user.id}) 创建聊天室失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 创建私聊聊天室
exports.createPrivateRoom = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        
        // 获取当前用户和目标用户
        const currentUser = req.user;
        const targetUser = await models.User.findByPk(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: '目标用户不存在' });
        }
        
        // 检查是否已经存在只有这两个用户的私聊房间
        const existingRooms = await models.Room.findAll({
            where: { 
                isPrivate: true 
            },
            include: [{
                model: models.User,
                as: 'Participants',
                through: { attributes: [] } // 不需要join表的属性
            }]
        });
        
        for (const room of existingRooms) {
            const members = room.Participants;
            // 检查是否只有这两个用户且正好两个用户
            if (members.length === 2 && 
                members.some(m => m.id === currentUser.id) && 
                members.some(m => m.id === targetUser.id)) {
                return res.json(room);
            }
        }
        
        // 创建新的私聊聊天室
        const roomName = `私聊-${currentUser.username}-${targetUser.username}`;
        const room = await models.Room.create({
            name: roomName,
            creatorId: currentUser.id,
            isPrivate: true,
            requireApproval: false,
            allowImages: true,
            allowVideos: true,
            allowFiles: true,
            retentionDays: 180,
            members: [currentUser.id, targetUser.id] // 初始化成员列表
        });
        
        // 将两个用户加入聊天室
        await models.RoomMember.create({
            userId: currentUser.id,
            roomId: room.id,
            isModerator: true
        });
        await models.RoomMember.create({
            userId: targetUser.id,
            roomId: room.id,
            isModerator: false
        });
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取用户加入的聊天室列表
exports.getUserRooms = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 查找用户加入的聊天室
        const rooms = await models.RoomMember.findAll({
            where: { userId: userId },
            include: [{
                model: models.Room,
                as: 'Room',
                include: [{
                    model: models.User,
                    as: 'Creator',
                    attributes: ['id', 'username', 'nickname', 'avatarUrl']
                }]
            }]
        });

        // 格式化返回数据
        const formattedRooms = rooms.map(roomMember => {
            const room = roomMember.Room;
            return {
                id: room.id,
                name: room.name,
                isPrivate: room.isPrivate,
                creator: {
                    id: room.Creator.id,
                    username: room.Creator.username,
                    nickname: room.Creator.nickname,
                    avatarUrl: room.Creator.avatarUrl
                },
                createdAt: room.createdAt
            };
        });

        res.json(formattedRooms);
    } catch (error) {
        log('ERROR', `用户 ${req.user.username}(ID: ${req.user.id}) 获取聊天室列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取用户所在聊天室列表
exports.getRooms = async (req, res) => {
    try {
        // 先获取用户加入的所有聊天室RID
        const roomMembers = await models.RoomMember.findAll({
            where: {
                user_id: req.user.id
            },
            attributes: ['room_id']
        });

        const roomIds = roomMembers.map(rm => rm.room_id);

        // 获取默认大聊天室（VentiChat大厅）
        const defaultRoom = await models.Room.findOne({
            where: {
                name: 'VentiChat大厅'
            }
        });

        // 如果存在默认聊天室且用户未加入，则添加到列表中
        if (defaultRoom && !roomIds.includes(defaultRoom.id)) {
            roomIds.push(defaultRoom.id);
        }

        // 如果用户没有加入任何聊天室，直接返回空数组
        if (roomIds.length === 0) {
            return res.json([]);
        }

        // 获取用户加入的聊天室详细信息（不使用include来避免关联错误）
        const joinedRooms = await models.Room.findAll({
            where: {
                id: {
                    [models.Sequelize.Op.in]: roomIds
                }
            },
            order: [['created_at', 'DESC']]
        });

        // 获取所有房间的创建者信息
        const creatorIds = [...new Set(joinedRooms.map(room => room.creatorId))];
        const creators = await models.User.findAll({
            where: {
                id: {
                    [models.Sequelize.Op.in]: creatorIds
                }
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl']
        });

        // 创建创建者信息映射
        const creatorMap = {};
        creators.forEach(creator => {
            creatorMap[creator.id] = creator;
        });

        // 获取用户的房间成员信息
        const roomMembersInfo = await models.RoomMember.findAll({
            where: {
                user_id: req.user.id,
                room_id: {
                    [models.Sequelize.Op.in]: roomIds
                }
            },
            attributes: ['room_id', 'note', 'last_read_message_id']
        });

        // 构建房间成员信息映射
        const roomMembersMap = {};
        roomMembersInfo.forEach(rm => {
            roomMembersMap[rm.room_id] = rm;
        });

        // 添加未读消息计数
        const enrichedRooms = await Promise.all(joinedRooms.map(async (room) => {
            // 检查是否是默认聊天室且用户未加入
            const isDefaultRoomNotJoined = defaultRoom && 
                room.id === defaultRoom.id && 
                !roomMembersMap[room.id];
            
            if (isDefaultRoomNotJoined) {
                // 对于未加入的默认聊天室，设置默认值
                return { 
                    ...room.get({ plain: true }), 
                    creator: creatorMap[room.creatorId] || null,
                    unreadCount: 0,
                    note: null
                };
            }

            // 对于已加入的聊天室，获取成员信息和未读消息数
            const roomMember = roomMembersMap[room.id];
            const lastReadMessageId = roomMember?.last_read_message_id || 0;
            
            if (!lastReadMessageId) {
                return { 
                    ...room.get({ plain: true }), 
                    creator: creatorMap[room.creatorId] || null,
                    unreadCount: 0,
                    note: roomMember?.note || null
                };
            }

            const unreadCount = await models.Message.count({
                where: {
                    room_id: room.id,
                    id: { [models.Sequelize.Op.gt]: lastReadMessageId }
                }
            });

            return { 
                ...room.get({ plain: true }), 
                creator: creatorMap[room.creatorId] || null,
                unreadCount,
                note: roomMember?.note || null
            };
        }));

        res.json(enrichedRooms);
    } catch (error) {
        log('ERROR', '获取聊天室列表时出错: ' + error);
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员列表
exports.getRoomMembers = async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // 获取房间信息，包括成员列表
        const room = await models.Room.findByPk(roomId);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });

        // 从房间的members字段获取成员ID列表
        const memberIds = room.members || [];
        
        // 如果没有成员，直接返回空数组
        if (memberIds.length === 0) {
            return res.json([]);
        }

        // 根据成员ID列表获取用户信息
        const members = await models.User.findAll({
            where: {
                id: memberIds
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl']
        });

        // 获取成员的额外信息（如是否为管理员等）
        const memberDetails = await models.RoomMember.findAll({
            where: {
                room_id: roomId,
                user_id: memberIds
            }
        });

        // 创建一个映射来快速查找成员详细信息
        const memberDetailsMap = {};
        memberDetails.forEach(detail => {
            memberDetailsMap[detail.user_id] = detail;
        });

        // 格式化返回数据
        const formattedMembers = members.map(member => {
            const detail = memberDetailsMap[member.id] || {};
            return {
                id: member.id,
                uid: member.id,  // 添加UID字段
                username: member.username,
                nickname: member.nickname,
                avatarUrl: member.avatarUrl || '/default-avatar.png',
                isModerator: detail.is_moderator || false,
                isCreator: member.id === room.creatorId, // 添加群主标识
                note: detail.note || null
            };
        });

        log('INFO', `成功获取房间 ${room.name}(RID: ${roomId}) 的成员列表，共 ${formattedMembers.length} 人`);
        res.json(formattedMembers);
    } catch (error) {
        log('ERROR', `获取聊天室成员列表时出错: ${error.message}`, { 
            stack: error.stack,
            params: req.params 
        });
        res.status(500).json({ 
            error: '获取成员列表失败',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// 添加成员
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        
        // 检查权限：必须是室主或室管
        const room = await models.Room.findByPk(id);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });
        
        const member = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId: id }
        });
        
        if (!member?.isModerator && room.creatorId !== req.user.id) {
            return res.status(403).json({ error: '没有权限添加成员' });
        }
        
        // 检查用户是否已经是成员
        const existingMember = await models.RoomMember.findOne({
            where: { userId, roomId: id }
        });
        if (existingMember) {
            return res.status(400).json({ error: '用户已是该聊天室成员' });
        }
        
        // 添加成员
        await models.RoomMember.create({
            userId,
            roomId: id,
            isModerator: false
        });
        
        // 更新房间的成员列表
        const currentMembers = room.members || [];
        if (!currentMembers.includes(userId)) {
            currentMembers.push(userId);
            await room.update({ members: currentMembers });
        }
        
        res.status(201).json({ message: '成员添加成功' });
    } catch (error) {
        log('ERROR', '添加成员时出错: ' + error);
        res.status(500).json({ error: error.message });
    }
};

// 踢出成员
exports.kickMember = async (req, res) => {
    try {
        const { roomId, userId } = req.params;
        const operatorId = req.user.id;
        
        // 使用工具函数踢出成员
        const { kickMember } = require('../utils/roomManager');
        const result = await kickMember(roomId, userId, operatorId);
        
        // 更新房间的成员列表
        const room = await models.Room.findByPk(roomId);
        if (room) {
            const currentMembers = room.members || [];
            const updatedMembers = currentMembers.filter(id => id !== parseInt(userId));
            await room.update({ members: updatedMembers });
        }
        
        res.json(result);
    } catch (error) {
        if (error.message === '用户不是该聊天室成员') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message === '只有聊天室创建者或管理员才能踢出成员' || 
            error.message === '不能踢出聊天室创建者' ||
            error.message === '管理员不能踢出自己') {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

// 更新聊天室设置
exports.updateRoomSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, requireApproval, allowImages, allowVideos, allowFiles, retentionDays } = req.body;
        
        // 检查权限：必须是室主
        const room = await models.Room.findByPk(id);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });
        
        if (room.creatorId !== req.user.id) {
            return res.status(403).json({ error: '只有室主可以修改设置' });
        }
        
        // 更新设置
        await room.update({
            name: name || room.name,
            requireApproval,
            allowImages,
            allowVideos,
            allowFiles,
            retentionDays: retentionDays || room.retentionDays
        });
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 发送聊天室加入请求
exports.sendJoinRequest = async (req, res) => {
    try {
        const { id } = req.params; // 聊天室RID
        const { message } = req.body;
        
        // 检查聊天室是否存在
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 检查是否需要审批
        if (!room.requireApproval) {
            return res.status(400).json({ error: '该聊天室不需要审批' });
        }
        
        // 检查用户是否已在聊天室中
        const existingMember = await models.RoomMember.findOne({
            where: { user_id: req.user.id, room_id: id }
        });
        if (existingMember) {
            return res.status(400).json({ error: '您已经是该聊天室的成员' });
        }
        
        // 检查是否已有待处理的请求
        const existingRequest = await models.JoinRequest.findOne({
            where: { user_id: req.user.id, room_id: id, status: 'pending' }
        });
        if (existingRequest) {
            return res.status(400).json({ error: '已有待处理的加入请求' });
        }
        
        // 创建加入请求
        await models.JoinRequest.create({
            user_id: req.user.id,
            room_id: id,
            message: message || null
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 审批聊天室加入请求
exports.approveJoinRequest = async (req, res) => {
    try {
        const { id } = req.params; // 聊天室RID
        const { userId, action } = req.body; // action: 'approve' or 'reject'
        
        // 检查聊天室是否存在且当前用户是创建者
        const room = await models.Room.findByPk(id);
        if (!room || room.creatorId !== req.user.id) {
            return res.status(403).json({ error: '您没有权限审批该请求' });
        }
        
        // 检查请求是否存在
        const request = await models.JoinRequest.findOne({
            where: { userId, roomId: id, status: 'pending' }
        });
        
        if (!request) {
            return res.status(404).json({ error: '请求不存在或已处理' });
        }
        
        if (action === 'approve') {
            // 批准：将用户加入聊天室
            await models.RoomMember.create({
                userId,
                roomId: id,
                isModerator: false
            });
            
            // 更新房间的成员列表
            const room = await models.Room.findByPk(id);
            const currentMembers = room.members || [];
            if (!currentMembers.includes(userId)) {
                currentMembers.push(userId);
                await room.update({ members: currentMembers });
            }
            
            await request.update({ status: 'approved' });
            
            // 通知用户请求被批准（可选）
            // 可以通过Socket.IO发送通知
        } else {
            // 拒绝：更新请求状态
            await request.update({ status: 'rejected' });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 搜索聊天室
exports.searchRooms = async (req, res) => {
    try {
        const { q: query } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: '查询参数不能为空' });
        }
        
        // 使用工具函数搜索聊天室
        const { searchRooms } = require('../utils/roomManager');
        const rooms = await searchRooms(query);
        
        res.json({ rooms });
    } catch (error) {
        log('ERROR', '搜索聊天室时出错: ' + error);
        res.status(500).json({ error: error.message });
    }
};