const { Op } = require('sequelize');
const models = require('../models');
const { log } = require('../utils/logger');

// 创建聊天室
exports.createRoom = async (req, res) => {
    try {
        const { name, isPrivate, requireApproval, allowImages, allowVideos, allowFiles } = req.body;
        
        // 记录创建聊天室的尝试
        log('INFO', `用户 ${req.user.username}(ID: ${req.user.userId}) 正在创建聊天室: ${name}`);

        // 创建聊天室
        const room = await models.Room.create({
            name,
            creatorId: req.user.userId,  // 使用模型属性名
            isPrivate: isPrivate || false,
            requireApproval: requireApproval !== undefined ? requireApproval : true,
            allowImages: allowImages !== undefined ? allowImages : true,
            allowVideos: allowVideos !== undefined ? allowVideos : true,
            allowFiles: allowFiles !== undefined ? allowFiles : true
        });

        // 将创建者加入聊天室并设为室主
        await models.RoomMember.create({
            userId: req.user.userId,
            roomId: room.roomId,
            isModerator: true
        });

        // 记录聊天室创建成功
        log('INFO', `用户 ${req.user.username}(ID: ${req.user.userId}) 成功创建聊天室: ${name}(ID: ${room.roomId})`);

        // 返回格式化的房间信息
        res.json({
            roomId: room.roomId,
            name: room.name,
            creatorId: room.creatorId,
            isPrivate: room.isPrivate,
            requireApproval: room.requireApproval,
            allowImages: room.allowImages,
            allowVideos: room.allowVideos,
            allowFiles: room.allowFiles,
            createdAt: room.createdAt
        });
    } catch (error) {
        // 记录创建聊天室失败
        log('ERROR', `用户 ${req.user.username}(ID: ${req.user.userId}) 创建聊天室失败: ${error.message}`);
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
        
        // 检查是否已经存在与该用户的私聊房间
        const existingPrivateRoom = await models.Room.findOne({
            where: {
                isPrivate: true,
                [Op.and]: [
                    {
                        [Op.or]: [
                            { creatorId: currentUser.id },
                            { creatorId: targetUserId }
                        ]
                    },
                    {
                        [Op.or]: [
                            { creatorId: targetUserId },
                            { creatorId: currentUser.id }
                        ]
                    }
                ]
            }
        });
        
        if (existingPrivateRoom) {
            return res.status(400).json({ 
                error: '与该用户的私聊房间已存在',
                roomId: existingPrivateRoom.roomId
            });
        }
        
        // 创建私聊房间
        const privateRoom = await models.Room.create({
            name: `${currentUser.username} 与 ${targetUser.username} 的私聊`,
            creatorId: currentUser.id,
            isPrivate: true,
            requireApproval: false,
            allowImages: true,
            allowVideos: true,
            allowFiles: true,
            members: [currentUser.id, targetUserId]
        });
        
        // 将双方都加入房间
        await models.RoomMember.bulkCreate([
            {
                userId: currentUser.id,
                roomId: privateRoom.roomId,
                isModerator: true
            },
            {
                userId: targetUser.id,
                roomId: privateRoom.roomId,
                isModerator: false
            }
        ]);
        
        res.json({
            message: '私聊房间创建成功',
            roomId: privateRoom.roomId
        });
    } catch (error) {
        log('ERROR', `创建私聊房间失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取用户加入的聊天室列表
exports.getUserRooms = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // 查找用户加入的聊天室
        const roomMembers = await models.RoomMember.findAll({
            where: { userId: userId }
        });
        
        // 获取房间ID列表
        const roomIds = roomMembers.map(rm => rm.roomId);
        
        if (roomIds.length === 0) {
            return res.json([]);
        }
        
        // 获取房间详细信息
        const rooms = await models.Room.findAll({
            where: {
                roomId: {
                    [Op.in]: roomIds
                }
            }
        });
        
        // 获取房间创建者ID列表
        const creatorIds = [...new Set(rooms.map(room => room.creatorId))];
        
        // 获取创建者信息
        const creators = await models.User.findAll({
            where: {
                userId: {
                    [Op.in]: creatorIds
                }
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        // 创建创建者信息映射
        const creatorMap = {};
        creators.forEach(creator => {
            creatorMap[creator.userId] = creator;
        });
        
        // 创建房间ID到房间成员关系的映射
        const roomMemberMap = {};
        roomMembers.forEach(rm => {
            roomMemberMap[rm.roomId] = rm;
        });

        // 格式化返回数据
        const formattedRooms = rooms.map(room => {
            return {
                id: room.roomId,
                name: room.name,
                isPrivate: room.isPrivate,
                creator: creatorMap[room.creatorId],
                createdAt: room.createdAt
            };
        });

        res.json(formattedRooms);
    } catch (error) {
        log('ERROR', `用户 ${req.user.username}(ID: ${req.user.userId}) 获取聊天室列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取用户所在聊天室列表
exports.getRooms = async (req, res) => {
    try {
        // 先获取用户加入的所有房间ID
        const roomMembers = await models.RoomMember.findAll({
            where: { userId: req.user.userId },
            attributes: ['roomId']
        });
        
        const roomIds = roomMembers.map(rm => rm.roomId);
        
        if (roomIds.length === 0) {
            return res.json([]);
        }
        
        // 获取房间详细信息
        const rooms = await models.Room.findAll({
            where: {
                roomId: {
                    [Op.in]: roomIds
                }
            }
        });
        
        // 格式化返回数据，确保包含id字段
        const formattedRooms = rooms.map(room => ({
            id: room.roomId,
            roomId: room.roomId,
            name: room.name,
            isPrivate: room.isPrivate,
            requireApproval: room.requireApproval,
            allowImages: room.allowImages,
            allowVideos: room.allowVideos,
            allowFiles: room.allowFiles,
            retentionDays: room.retentionDays,
            creatorId: room.creatorId,
            createdAt: room.createdAt
        }));
        
        res.json(formattedRooms);
    } catch (error) {
        log('ERROR', `获取房间列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取特定聊天室信息
exports.getRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // 检查用户是否是该房间的成员
        const roomMember = await models.RoomMember.findOne({
            where: {
                roomId: id,
                userId: userId
            }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取房间信息
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员列表
exports.getRoomMembers = async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // 验证roomId参数
        if (!roomId || roomId === 'undefined' || String(roomId).trim() === '' || String(roomId).trim() === 'undefined') {
            return res.status(400).json({ error: '无效的聊天室ID' });
        }
        
        // 检查用户是否是该房间的成员
        const membership = await models.RoomMember.findOne({
            where: {
                userId: req.user.userId,
                roomId: roomId
            }
        });
        
        if (!membership) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取房间信息以获取创建者ID
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 获取房间成员
        const roomMembers = await models.RoomMember.findAll({
            where: { roomId: roomId }
        });
        
        // 获取涉及的用户ID列表
        const userIds = roomMembers.map(rm => rm.userId);
        
        // 获取用户信息
        const users = await models.User.findAll({
            where: {
                userId: {
                    [Op.in]: userIds
                }
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        // 创建用户信息映射
        const userMap = {};
        users.forEach(user => {
            userMap[user.userId] = user;
        });
        
        // 格式化成员信息
        const members = roomMembers.map(rm => {
            const user = userMap[rm.userId];
            return {
                uid: user.userId,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl || '/default-avatar.png',
                isCreator: user.userId === room.creatorId,
                isModerator: rm.isModerator
            };
        });
        
        res.json(members);
    } catch (error) {
        log('ERROR', `获取房间成员列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取聊天室成员ID列表（公开接口）
exports.getRoomMemberIds = async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // 验证roomId参数
        if (!roomId || roomId === 'undefined' || String(roomId).trim() === '' || String(roomId).trim() === 'undefined') {
            return res.status(400).json({ error: '无效的聊天室ID' });
        }
        
        // 获取房间成员ID列表
        const roomMembers = await models.RoomMember.findAll({
            where: { roomId: roomId },
            attributes: ['userId']
        });
        
        // 提取用户ID列表
        const userIds = roomMembers.map(rm => rm.userId);
        
        res.json(userIds);
    } catch (error) {
        log('ERROR', `获取房间成员ID列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 根据用户ID列表获取用户信息（公开接口）
exports.getUsersByIds = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        // 验证参数
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: '无效的用户ID列表' });
        }
        
        // 过滤掉无效的用户ID
        const validUserIds = userIds.filter(id => 
            id && 
            id !== 'undefined' && 
            id !== 'null' && 
            String(id).trim() !== '' && 
            String(id).trim() !== 'undefined' &&
            !isNaN(id)
        );
        
        if (validUserIds.length === 0) {
            return res.status(400).json({ error: '无效的用户ID列表' });
        }
        
        // 获取用户信息
        const users = await models.User.findAll({
            where: {
                userId: {
                    [Op.in]: validUserIds
                }
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json(users);
    } catch (error) {
        log('ERROR', `根据ID列表获取用户信息失败: ${error.message}`);
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
            where: { userId: req.user.userId, roomId: id }
        });
        
        if (!member?.isModerator && room.creatorId !== req.user.userId) {
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

// 踢出房间成员
exports.kickMember = async (req, res) => {
    try {
        const { roomId, userId } = req.params;
        
        // 检查操作者是否是房间管理员
        const operatorMembership = await models.RoomMember.findOne({
            where: {
                userId: req.user.userId,
                roomId: roomId
            }
        });
        
        if (!operatorMembership || !operatorMembership.isModerator) {
            return res.status(403).json({ error: '您没有权限踢出成员' });
        }
        
        // 检查目标用户是否是房间创建者
        const room = await models.Room.findByPk(roomId);
        if (room && room.creatorId == userId) {
            return res.status(403).json({ error: '不能踢出房间创建者' });
        }
        
        // 踢出成员
        await models.RoomMember.destroy({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        // 从房间成员列表中移除
        if (room) {
            const members = room.members.filter(id => id != userId);
            await room.update({ members });
        }
        
        res.json({ message: '成员已踢出' });
    } catch (error) {
        log('ERROR', `踢出房间成员失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 更新聊天室设置
exports.updateRoomSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, requireApproval, allowImages, allowVideos, allowFiles } = req.body;
        
        // 检查权限：必须是室主
        const room = await models.Room.findByPk(id);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });
        
        if (room.creatorId !== req.user.userId) {
            return res.status(403).json({ error: '只有室主可以修改设置' });
        }
        
        // 更新设置
        await room.update({
            name: name || room.name,
            requireApproval,
            allowImages,
            allowVideos,
            allowFiles
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
            // 如果不需要审批，直接加入聊天室
            const existingMember = await models.RoomMember.findOne({
                where: { userId: req.user.userId, roomId: id }
            });
            if (existingMember) {
                return res.status(400).json({ error: '您已经是该聊天室的成员' });
            }
            
            // 直接创建房间成员
            await models.RoomMember.create({
                userId: req.user.userId,
                roomId: id,
                isModerator: false
            });

            // 更新房间的成员列表
            const currentMembers = room.members || [];
            if (!currentMembers.includes(req.user.userId)) {
                currentMembers.push(req.user.userId);
                await room.update({ members: currentMembers });
            }

            return res.json({ success: true, message: '已成功加入聊天室' });
        }
        
        // 检查用户是否已在聊天室中
        const existingMember = await models.RoomMember.findOne({
            where: { userId: req.user.userId, roomId: id }
        });
        if (existingMember) {
            return res.status(400).json({ error: '您已经是该聊天室的成员' });
        }
        
        // 检查是否已有待处理的请求
        const existingRequest = await models.JoinRequest.findOne({
            where: { userId: req.user.userId, roomId: id, status: 'pending' }
        });
        if (existingRequest) {
            return res.status(400).json({ error: '已有待处理的加入请求' });
        }
        
        // 创建加入请求
        await models.JoinRequest.create({
            userId: req.user.userId,
            roomId: id,
            message: message || null
        });
        
        res.json({ success: true, message: '加入请求已发送' });
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
        if (!room || room.creatorId !== req.user.userId) {
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
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: '搜索关键字不能为空' });
        }
        
        // 搜索公开房间
        const rooms = await models.Room.findAll({
            where: {
                name: {
                    [Op.like]: `%${q}%`
                },
                isPrivate: false
            },
            limit: 20
        });
        
        // 获取房间创建者信息
        const roomWithCreators = await Promise.all(rooms.map(async (room) => {
            const creator = await models.User.findByPk(room.creatorId, {
                attributes: ['userId', 'username', 'nickname']
            });
            
            // 计算成员数量
            const memberCount = await models.RoomMember.count({
                where: { roomId: room.roomId }
            });
            
            return {
                id: room.roomId,
                name: room.name,
                creatorNickname: creator ? creator.nickname : '未知用户',
                memberCount: memberCount
            };
        }));
        
        res.json({
            rooms: roomWithCreators
        });
    } catch (error) {
        log('ERROR', `搜索房间失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};