const { Room, RoomMember, User, Message, JoinRequest } = require('../models');

// 创建聊天室
exports.createRoom = async (req, res) => {
    try {
        const { name, isPrivate, requireApproval, allowImages, allowVideos, allowFiles, retentionDays } = req.body;
        
        // 创建聊天室
        const room = await Room.create({
            name,
            creatorId: req.user.id,
            isPrivate: isPrivate || false,
            requireApproval: requireApproval !== undefined ? requireApproval : true,
            allowImages: allowImages !== undefined ? allowImages : true,
            allowVideos: allowVideos !== undefined ? allowVideos : true,
            allowFiles: allowFiles !== undefined ? allowFiles : true,
            retentionDays: retentionDays || 180
        });

        // 将创建者加入聊天室并设为室主
        await RoomMember.create({
            userId: req.user.id,
            roomId: room.id,
            isModerator: true
        });

        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 创建私聊聊天室
exports.createPrivateRoom = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        
        // 获取当前用户和目标用户
        const currentUser = req.user;
        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ error: '目标用户不存在' });
        }
        
        // 检查是否已存在私聊聊天室
        const existingRooms = await Room.findAll({
            where: {
                isPrivate: true,
                creatorId: {
                    [Sequelize.Op.in]: [currentUser.id, targetUser.id]
                }
            },
            include: [{
                model: RoomMember,
                where: { userId: { [Sequelize.Op.in]: [currentUser.id, targetUser.id] } },
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
        const room = await Room.create({
            name: roomName,
            creatorId: currentUser.id,
            isPrivate: true,
            requireApproval: false,
            allowImages: true,
            allowVideos: true,
            allowFiles: true,
            retentionDays: 180
        });
        
        // 将两个用户加入聊天室
        await RoomMember.create({
            userId: currentUser.id,
            roomId: room.id,
            isModerator: true
        });
        await RoomMember.create({
            userId: targetUser.id,
            roomId: room.id,
            isModerator: false
        });
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取用户所在聊天室列表
exports.getUserRooms = async (req, res) => {
    try {
        const rooms = await req.user.getJoinedRooms({
            include: [{
                model: RoomMember,
                where: { userId: req.user.id },
                attributes: ['note']
            }]
        });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员列表
exports.getRoomMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const members = await models.Room.findByPk(id, {
            include: [{
                model: User,
                through: { attributes: ['isModerator', 'note'] }
            }]
        });
        res.json(members?.RoomParticipants || []);
    } catch (error) {
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
        
        // 添加成员
        await RoomMember.create({
            userId,
            roomId: id
        });
        
        res.status(201).json({ message: '成员添加成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 移除成员（踢人）
exports.kickUser = async (req, res) => {
    try {
        const { id, userId } = req.params;
        
        // 检查权限：必须是室主或室管
        const room = await models.Room.findByPk(id);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });
        
        const member = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId: id }
        });
        
        if (!member?.isModerator && room.creatorId !== req.user.id) {
            return res.status(403).json({ error: '没有权限踢人' });
        }
        
        // 不能踢出室主
        if (room.creatorId === parseInt(userId)) {
            return res.status(403).json({ error: '不能踢出室主' });
        }
        
        // 移除成员
        await models.RoomMember.destroy({
            where: { userId, roomId: id }
        });
        
        res.json({ message: '成员已移除' });
    } catch (error) {
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
