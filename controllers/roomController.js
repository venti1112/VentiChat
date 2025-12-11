const { Op } = require('sequelize');
const models = require('../models');
const { log } = require('../utils/logger');

// 创建聊天室
exports.createRoom = async (req, res) => {
    try {
        const { name, isPrivate, requireApproval, allowImages, allowVideos, allowFiles, allowAudio } = req.body;
        
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
            allowFiles: allowFiles !== undefined ? allowFiles : true,
            allowAudio: allowAudio !== undefined ? allowAudio : true
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
            allowAudio: room.allowAudio,
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
        // 首先查找当前用户参与的所有私聊房间
        const currentUserRoomMembers = await models.RoomMember.findAll({
            where: {
                userId: currentUser.userId
            }
        });
        
        // 获取这些房间的ID
        const currentUserRoomIds = currentUserRoomMembers.map(roomMember => roomMember.roomId);
        
        if (currentUserRoomIds.length > 0) {
            // 查找这些房间中是否是私聊房间并且目标用户也参与
            const privateRooms = await models.Room.findAll({
                where: {
                    roomId: {
                        [Op.in]: currentUserRoomIds
                    },
                    isPrivate: true
                }
            });
            
            const privateRoomIds = privateRooms.map(room => room.roomId);
            
            if (privateRoomIds.length > 0) {
                // 查找这些私聊房间中是否有目标用户也参与的
                const commonRooms = await models.RoomMember.findOne({
                    where: {
                        userId: targetUserId,
                        roomId: {
                            [Op.in]: privateRoomIds
                        }
                    }
                });
                
                if (commonRooms) {
                    return res.status(400).json({ 
                        error: '与该用户的私聊房间已存在',
                        roomId: commonRooms.roomId
                    });
                }
            }
        }
        
        // 创建私聊房间
        const privateRoom = await models.Room.create({
            name: `${currentUser.username} 与 ${targetUser.username} 的私聊`,
            creatorId: currentUser.userId,
            isPrivate: true,
            requireApproval: false,
            allowImages: true,
            allowVideos: true,
            allowFiles: true
        });
        
        // 将双方都加入房间
        await models.RoomMember.create({
            userId: currentUser.userId,
            roomId: privateRoom.roomId,
            isModerator: true
        });
        
        await models.RoomMember.create({
            userId: targetUser.userId,
            roomId: privateRoom.roomId,
            isModerator: false
        });
        
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
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        const userId = req.user.userId;
        
        const room = await models.Room.findByPk(roomId);
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
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        
        // 验证roomId参数
        if (!roomId || roomId === 'undefined' || String(roomId).trim() === '' || String(roomId).trim() === 'undefined') {
            return res.status(400).json({ error: '无效的聊天室ID' });
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

// 踢出房间成员
exports.kickMember = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId, userId } = req.params;
        
        // 踢出成员
        await models.RoomMember.destroy({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        res.json({ message: '成员已踢出' });
    } catch (error) {
        log('ERROR', `踢出房间成员失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 更新聊天室设置
exports.updateRoomSettings = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        const { name, requireApproval, allowImages, allowVideos, allowFiles, allowAudio } = req.body;
        
        // 检查聊天室是否存在
        const room = await models.Room.findByPk(roomId);
        if (!room) return res.status(404).json({ error: '聊天室不存在' });
        
        // 更新设置
        await room.update({
            name: name || room.name,
            requireApproval,
            allowImages,
            allowVideos,
            allowFiles,
            allowAudio
        });
        
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 发送聊天室加入请求
exports.sendJoinRequest = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        // 对于GET请求，从查询参数中获取message，对于POST请求，从body中获取
        const { message } = req.method === 'GET' ? req.query : req.body;
        
        // 检查聊天室是否存在
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 检查是否需要审批
        if (!room.requireApproval) {
            // 如果不需要审批，直接加入聊天室
            const existingMember = await models.RoomMember.findOne({
                where: { userId: req.user.userId, roomId: roomId }
            });
            if (existingMember) {
                return res.status(400).json({ error: '您已经是该聊天室的成员' });
            }
            
            // 直接创建房间成员
            await models.RoomMember.create({
                userId: req.user.userId,
                roomId: roomId,
                isModerator: false
            });

            return res.json({ success: true, message: '已成功加入聊天室', joined: true });
        }
        
        // 检查是否已有待处理的请求
        const existingRequest = await models.JoinRequest.findOne({
            where: { userId: req.user.userId, roomId: roomId, status: 'pending' }
        });
        if (existingRequest) {
            return res.status(400).json({ error: '已有待处理的加入请求' });
        }
        
        // 创建加入请求
        await models.JoinRequest.create({
            userId: req.user.userId,
            roomId: roomId,
            message: message || null
        });
        
        res.json({ success: true, message: '加入请求已发送', joined: false });
    } catch (error) {
        log('ERROR', `发送加入请求失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 邀请用户加入聊天室
exports.addMember = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId, userId } = req.params;
        
        // 查找聊天室
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 检查被邀请用户是否已经是成员
        const existingMember = await models.RoomMember.findOne({
            where: { 
                userId: userId,
                roomId: roomId
            }
        });
        
        if (existingMember) {
            return res.status(400).json({ error: '用户已经是该聊天室成员' });
        }
        
        // 添加用户为聊天室成员
        await models.RoomMember.create({
            userId,
            roomId,
            isModerator: false
        });
        
        // 检查是否有对应的加入请求，如果有则一并处理
        const joinRequest = await models.JoinRequest.findOne({
            where: { 
                userId: userId, 
                roomId: roomId, 
                status: 'pending' 
            }
        });
        
        if (joinRequest) {
            // 将加入请求标记为已批准
            await joinRequest.update({ status: 'approved' });
        }
        
        res.json({ success: true, message: '用户已成功加入聊天室' });
    } catch (error) {
        log('ERROR', `邀请用户加入聊天室失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 拒绝用户加入聊天室的请求
exports.rejectJoinRequest = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId, userId } = req.params;
        
        // 查找聊天室
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 查找加入请求
        const joinRequest = await models.JoinRequest.findOne({
            where: { 
                userId: userId, 
                roomId: roomId, 
                status: 'pending' 
            }
        });
        
        if (!joinRequest) {
            return res.status(404).json({ error: '未找到待处理的加入请求' });
        }
        
        // 将加入请求标记为已拒绝
        await joinRequest.update({ status: 'rejected' });
        
        res.json({ success: true, message: '已拒绝用户的加入请求' });
    } catch (error) {
        log('ERROR', `拒绝用户加入请求失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取待处理的加入请求
exports.getPendingRequests = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        
        // 检查聊天室是否存在
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 如果聊天室不需要审批，则不显示审批区域
        if (!room.requireApproval) {
            return res.json([]);
        }
        
        // 获取所有待处理的加入请求
        const pendingRequests = await models.JoinRequest.findAll({
            where: { 
                roomId: roomId, 
                status: 'pending' 
            },
            order: [['requestTime', 'ASC']]
        });
        
        // 手动获取用户信息
        const userIds = pendingRequests.map(request => request.userId);
        let users = [];
        if (userIds.length > 0) {
            users = await models.User.findAll({
                where: {
                    userId: userIds
                },
                attributes: ['userId', 'username', 'nickname', 'avatarUrl']
            });
        }
        
        // 创建用户映射
        const userMap = {};
        users.forEach(user => {
            userMap[user.userId] = user;
        });
        
        // 将用户信息附加到请求中
        const requestsWithUsers = pendingRequests.map(request => {
            return {
                ...request.toJSON(),
                user: userMap[request.userId] || null
            };
        });
        
        res.json(requestsWithUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
        log('ERROR', `获取待处理的加入请求失败: ${error.message}`);
    }
};

// 搜索聊天室
exports.search = async (req, res) => {
    try {
        const { q: query } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: '搜索关键字不能为空' });
        }
        
        // 搜索公开房间
        const rooms = await models.Room.findAll({
            where: {
                [Op.or]: [
                    {
                        name: {
                            [Op.like]: `%${query}%`
                        }
                    },
                    !isNaN(parseInt(query)) ? {
                        roomId: parseInt(query)
                    } : null
                ].filter(Boolean),
                isPrivate: false
            },
            limit: 10
        });
        
        // 搜索用户
        const users = await models.User.findAll({
            where: {
                [Op.or]: [
                    {
                        username: {
                            [Op.like]: `%${query}%`
                        }
                    },
                    {
                        nickname: {
                            [Op.like]: `%${query}%`
                        }
                    },
                    !isNaN(parseInt(query)) ? {
                        userId: parseInt(query)
                    } : null
                ].filter(Boolean)
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl'],
            limit: 10
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
                type: 'room',
                id: room.roomId,
                name: room.name,
                creatorNickname: creator ? creator.nickname : '未知用户',
                memberCount: memberCount
            };
        }));
        
        // 格式化用户数据
        const formattedUsers = users.map(user => ({
            type: 'user',
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        }));
        
        res.json({
            results: [...roomWithCreators, ...formattedUsers]
        });
    } catch (error) {
        log('ERROR', `搜索失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 设置成员角色
exports.setMemberRole = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId, userId } = req.params;
        const { role } = req.body;
        
        // 检查聊天室是否存在
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 验证角色值
        if (!['member', 'admin'].includes(role)) {
            return res.status(400).json({ error: '无效的角色值' });
        }
        
        // 检查目标用户是否是聊天室成员
        const targetMember = await models.RoomMember.findOne({
            where: { 
                userId: userId,
                roomId: roomId
            }
        });
        
        if (!targetMember) {
            return res.status(404).json({ error: '目标用户不是该聊天室成员' });
        }
        
        // 检查不能修改室主的角色
        if (room.creatorId == userId) {
            return res.status(400).json({ error: '不能修改室主的角色' });
        }
        
        // 更新成员角色
        await targetMember.update({ isModerator: role === 'admin' });
        
        res.json({ success: true, message: '角色设置成功' });
    } catch (error) {
        log('ERROR', `设置成员角色失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（仅限房主）
exports.deleteRoom = async (req, res) => {
    try {
        // 修复参数名称不一致的问题
        const { roomId } = req.params;
        const userId = req.user.userId;
        
        // 获取房间信息
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 检查用户是否是该房间的创建者
        if (room.creatorId !== userId) {
            return res.status(403).json({ error: '只有房主才能解散聊天室' });
        }
        
        // 删除房间相关数据
        // 1. 删除房间成员关系
        await models.RoomMember.destroy({
            where: {
                roomId: roomId
            }
        });
        
        // 2. 删除房间消息
        await models.Message.destroy({
            where: {
                roomId: roomId
            }
        });
        
        // 3. 删除房间本身
        await models.Room.destroy({
            where: {
                roomId: roomId
            }
        });
        
        log('INFO', `用户 ${req.user.username}(ID: ${userId}) 已解散聊天室: ${room.name}(ID: ${roomId})`);
        
        res.json({ message: '聊天室已成功解散' });
    } catch (error) {
        log('ERROR', `用户 ${req.user.username}(ID: ${req.user.userId}) 解散聊天室失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};