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
            creator_id: req.user.id,
            is_private: isPrivate || false,
            require_approval: requireApproval !== undefined ? requireApproval : true,
            allow_images: allowImages !== undefined ? allowImages : true,
            allow_videos: allowVideos !== undefined ? allowVideos : true,
            allow_files: allowFiles !== undefined ? allowFiles : true,
            retention_days: retentionDays || 180
        });

        // 将创建者加入聊天室并设为室主
        await models.RoomMember.create({
            userId: req.user.id,
            roomId: room.id,
            isModerator: true
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
        
        // 检查是否已存在私聊聊天室
        const existingRooms = await models.Room.findAll({
            where: {
                is_private: true,
                creator_id: {
                    [Op.in]: [currentUser.id, targetUser.id]
                }
            },
            include: [{
                model: models.RoomMember,
                where: { user_id: { [Op.in]: [currentUser.id, targetUser.id] } },
                attributes: []
            }]
        });
        
        for (const room of existingRooms) {
            const members = await room.getParticipants();
            if (members.length === 2 && members.some(m => m.id === currentUser.id) && members.some(m => m.id === targetUser.id)) {
                return res.json(room);
            }
        }
        
        // 创建新的私聊聊天室
        const roomName = `私聊-${currentUser.username}-${targetUser.username}`;
        const room = await models.Room.create({
            name: roomName,
            creator_id: currentUser.id,
            is_private: true,
            require_approval: false,
            allow_images: true,
            allow_videos: true,
            allow_files: true,
            retention_days: 180
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
        // 获取用户加入的所有聊天室
        const joinedRooms = await req.user.getJoinedRooms({
            include: [{
                model: models.RoomMember,
                as: 'RoomMemberships',
                attributes: ['note', 'last_read_message_id'],
                where: {
                    user_id: req.user.id
                }
            }]
        });

        // 获取默认大聊天室（VentiChat大厅）
        const defaultRoom = await models.Room.findOne({
            where: {
                name: 'VentiChat大厅'
            }
        });

        // 确保默认聊天室在列表中
        let allRooms = [...joinedRooms];
        const isJoinedDefaultRoom = defaultRoom ? 
            joinedRooms.some(room => room.id === defaultRoom.id) : false;
        
        if (defaultRoom && !isJoinedDefaultRoom) {
            // 如果用户没有加入默认聊天室，也要显示它
            allRooms.push(defaultRoom);
        }

        // 添加未读消息计数
        const enrichedRooms = await Promise.all(allRooms.map(async (room) => {
            // 检查是否是默认聊天室且用户未加入
            const isDefaultRoomNotJoined = defaultRoom && 
                room.id === defaultRoom.id && 
                !isJoinedDefaultRoom;
            
            if (isDefaultRoomNotJoined) {
                // 对于未加入的默认聊天室，设置默认值
                return { 
                    ...room.get({ plain: true }), 
                    unreadCount: 0,
                    note: null
                };
            }

            // 对于已加入的聊天室，获取成员信息和未读消息数
            const roomMember = room.RoomMemberships && room.RoomMemberships.length > 0 ? 
                room.RoomMemberships[0] : null;
            const lastReadMessageId = roomMember?.last_read_message_id || 0;
            
            if (!lastReadMessageId) {
                return { 
                    ...room.get({ plain: true }), 
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
                unreadCount,
                note: roomMember?.note || null
            };
        }));

        res.json(enrichedRooms);
    } catch (error) {
        log('ERROR', '获取聊天室时出错: ' + error);
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员列表
exports.getRoomMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await models.Room.findByPk(id, {
            include: [{
                model: models.User,
                through: { attributes: ['isModerator', 'note'] },
                as: 'Participants'
            }]
        });
        res.json(room?.Participants || []);
    } catch (error) {
        log('ERROR', '获取聊天室成员时出错: ' + error);
        res.status(500).json({ error: error.message });
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
        const { id } = req.params; // 聊天室ID
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
            where: { userId: req.user.id, roomId: id }
        });
        if (existingMember) {
            return res.status(400).json({ error: '您已经是该聊天室的成员' });
        }
        
        // 检查是否已有待处理的请求
        const existingRequest = await models.JoinRequest.findOne({
            where: { userId: req.user.id, roomId: id, status: 'pending' }
        });
        if (existingRequest) {
            return res.status(400).json({ error: '已有待处理的加入请求' });
        }
        
        // 创建加入请求
        await models.JoinRequest.create({
            userId: req.user.id,
            roomId: id,
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
        const { id } = req.params; // 聊天室ID
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