// 导入Sequelize和模型
const Sequelize = require('sequelize');
const models = require('../models');
const { log } = require('./logger');

// 创建聊天室
const createRoom = async (creatorId, roomData) => {
    try {
        // 验证创建者存在
        const creator = await models.User.findByPk(creatorId);
        if (!creator) {
            throw new Error('创建者不存在');
        }
        
        // 创建聊天室
        const room = await models.Room.create({
            name: roomData.name,
            creatorId: creatorId,
            isPrivate: roomData.isPrivate || false,
            requireApproval: roomData.requireApproval !== undefined ? roomData.requireApproval : true,
            allowImages: roomData.allowImages !== undefined ? roomData.allowImages : true,
            allowVideos: roomData.allowVideos !== undefined ? roomData.allowVideos : true,
            allowFiles: roomData.allowFiles !== undefined ? roomData.allowFiles : true,
            retentionDays: roomData.retentionDays || 180
        });
        
        // 将创建者加入聊天室并设为管理员
        await models.RoomMember.create({
            userId: creatorId,
            roomId: room.id,
            isModerator: true
        });
        
        return room;
    } catch (error) {
        log('ERROR', '创建聊天室失败: ' + error.message);
        throw error;
    }
};

// 用户加入聊天室
const joinRoom = async (userId, roomId, requireApproval = true) => {
    try {
        // 检查用户和聊天室是否存在
        const user = await models.User.findByPk(userId);
        const room = await models.Room.findByPk(roomId);
        
        if (!user) {
            throw new Error('用户不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查是否已经是成员
        const existingMembership = await models.RoomMember.findOne({
            where: {
                user_id: userId,
                room_id: roomId
            }
        });
        
        if (existingMembership) {
            throw new Error('用户已经是该聊天室成员');
        }
        
        // 检查聊天室是否需要审批
        if (room.require_approval && requireApproval) {
            // 创建加入请求
            const joinRequest = await models.JoinRequest.create({
                user_id: userId,
                room_id: roomId,
                status: 'pending'
            });
            
            return { 
                request: joinRequest,
                message: '加入请求已提交，等待管理员审批' 
            };
        }

        // 直接加入聊天室
        const roomMember = await models.RoomMember.create({
            user_id: userId,
            room_id: roomId,
            is_moderator: false
        });
        
        return { 
            member: roomMember,
            message: '成功加入聊天室' 
        };
    } catch (error) {
        log('ERROR', '加入聊天室失败: ' + error.message);
        throw error;
    }
};

// 离开聊天室
const leaveRoom = async (userId, roomId) => {
    try {
        // 检查用户和聊天室是否存在
        const user = await models.User.findByPk(userId);
        const room = await models.Room.findByPk(roomId);
        
        if (!user) {
            throw new Error('用户不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查是否是成员
        const membership = await models.RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (!membership) {
            throw new Error('用户不是该聊天室成员');
        }
        
        // 检查是否是创建者
        if (room.creatorId === userId) {
            throw new Error('聊天室创建者不能直接离开聊天室');
        }
        
        // 删除成员关系
        await membership.destroy();
        
        return { success: true, message: '成功离开聊天室' };
    } catch (error) {
        log('ERROR', '离开聊天室失败: ' + error.message);
        throw error;
    }
};

// 删除聊天室
const deleteRoom = async (roomId, operatorId) => {
    const transaction = await models.sequelize.transaction();
    try {
        // 在事务中检查聊天室是否存在
        const room = await models.Room.findByPk(roomId, { transaction });
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查操作者是否是创建者
        if (room.creatorId !== operatorId) {
            throw new Error('只有聊天室创建者可以删除聊天室');
        }
        
        // 在事务中删除聊天室（会级联删除相关数据）
        await room.destroy({ transaction });
        
        // 提交事务
        await transaction.commit();
        
        return { success: true, message: '聊天室已删除' };
    } catch (error) {
        // 如果有事务，则回滚
        await transaction.rollback();
        log('ERROR', '删除聊天室失败: ' + error.message);
        throw error;
    }
};

// 获取用户所在聊天室列表
const getUserRooms = async (userId) => {
    try {
        const user = await models.User.findByPk(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        
        const rooms = await models.RoomMember.findAll({
            where: { userId },
            include: [{
                model: models.Room,
                as: 'Room',
                include: [{
                    model: models.User,
                    as: 'Creator',
                    attributes: ['nickname']
                }]
            }]
        });
        
        return rooms.map(roomMember => {
            const room = roomMember.Room;
            return {
                id: room.id,
                name: room.name,
                isPrivate: room.isPrivate,
                creator: {
                    id: room.creatorId,
                    nickname: room.Creator ? room.Creator.nickname : '未知'
                },
                createdAt: room.createdAt
            };
        });
    } catch (error) {
        log('ERROR', '获取用户聊天室列表失败: ' + error.message);
        throw error;
    }
};

// 获取聊天室成员列表
const getRoomMembers = async (roomId) => {
    try {
        const room = await models.Room.findByPk(roomId);
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        const members = await models.RoomMember.findAll({
            where: { roomId },
            include: [{
                model: models.User,
                as: 'User',
                attributes: ['id', 'username', 'nickname', 'avatarUrl']
            }]
        });
        
        return members.map(member => ({
            id: member.User.id,
            username: member.User.username,
            nickname: member.User.nickname,
            avatarUrl: member.User.avatarUrl,
            isModerator: member.isModerator,
            joinTime: member.createdAt
        }));
    } catch (error) {
        log('ERROR', '获取聊天室成员列表失败: ' + error.message);
        throw error;
    }
};

// 添加成员（直接添加，不需要审批）
const addMember = async (roomId, userId, operatorId) => {
    try {
        // 检查操作者、目标用户和聊天室是否存在
        const operator = await models.User.findByPk(operatorId);
        const targetUser = await models.User.findByPk(userId);
        const room = await models.Room.findByPk(roomId);
        
        if (!operator) {
            throw new Error('操作者不存在');
        }
        
        if (!targetUser) {
            throw new Error('目标用户不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查操作者是否是聊天室的管理员或创建者
        const operatorMembership = await models.RoomMember.findOne({
            where: {
                userId: operatorId,
                roomId: roomId
            }
        });
        
        if (!operatorMembership || (!operatorMembership.isModerator && room.creatorId !== operatorId)) {
            throw new Error('只有聊天室创建者或管理员才能添加成员');
        }
        
        // 检查目标用户是否已经是成员
        const existingMembership = await models.RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (existingMembership) {
            throw new Error('用户已经是该聊天室成员');
        }
        
        // 添加成员
        const membership = await models.RoomMember.create({
            userId: userId,
            roomId: roomId,
            isModerator: false
        });
        
        return { success: true, membership };
    } catch (error) {
        log('ERROR', '添加成员失败: ' + error.message);
        throw error;
    }
};

// 踢出成员
const kickMember = async (roomId, userId, operatorId) => {
    try {
        // 检查操作者、目标用户和聊天室是否存在
        const operator = await models.User.findByPk(operatorId);
        const targetUser = await models.User.findByPk(userId);
        const room = await models.Room.findByPk(roomId);
        
        if (!operator) {
            throw new Error('操作者不存在');
        }
        
        if (!targetUser) {
            throw new Error('目标用户不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查操作者是否是聊天室的管理员或创建者
        const operatorMembership = await models.RoomMember.findOne({
            where: {
                userId: operatorId,
                roomId: roomId
            }
        });
        
        if (!operatorMembership || (!operatorMembership.isModerator && room.creatorId !== operatorId)) {
            throw new Error('只有聊天室创建者或管理员才能踢出成员');
        }
        
        // 检查目标用户是否是自己
        if (userId === operatorId) {
            throw new Error('不能踢出自己');
        }
        
        // 检查目标用户是否是创建者
        if (userId === room.creatorId) {
            throw new Error('不能踢出聊天室创建者');
        }
        
        // 检查目标用户是否是成员
        const membership = await models.RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (!membership) {
            throw new Error('用户不是该聊天室成员');
        }
        
        // 删除成员关系
        await membership.destroy();
        
        return { success: true, message: '成功踢出成员' };
    } catch (error) {
        log('ERROR', '踢出成员失败: ' + error.message);
        throw error;
    }
};

// 设置/取消管理员
const setModerator = async (roomId, targetUserId, isModerator, operatorId) => {
    try {
        // 检查操作者权限
        const operator = await models.User.findByPk(operatorId);
        const room = await models.Room.findByPk(roomId);
        
        if (!operator) {
            throw new Error('操作者不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 只有创建者可以设置/取消管理员
        if (room.creatorId !== operatorId) {
            throw new Error('只有聊天室创建者可以设置管理员');
        }
        
        // 检查目标用户是否是成员
        const membership = await models.RoomMember.findOne({
            where: {
                userId: targetUserId,
                roomId: roomId
            }
        });
        
        if (!membership) {
            throw new Error('目标用户不是该聊天室成员');
        }
        
        // 更新管理员状态
        membership.isModerator = isModerator;
        await membership.save();
        
        return { success: true, message: isModerator ? '已设为管理员' : '已取消管理员' };
    } catch (error) {
        log('ERROR', '设置管理员失败: ' + error);
        throw error;
    }
};

// 搜索聊天室
const searchRooms = async (query) => {
    try {
        const rooms = await models.Room.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { name: { [Sequelize.Op.like]: `%${query}%` } },
                    { id: parseInt(query) || 0 }
                ]
            },
            limit: 20
        });
        
        // 获取聊天室创建者信息
        const creatorIds = [...new Set(rooms.map(room => room.creator_id))];
        const creators = await models.User.findAll({
            where: {
                id: {
                    [Sequelize.Op.in]: creatorIds
                }
            },
            attributes: ['id', 'nickname']
        });
        
        // 创建创建者映射
        const creatorMap = {};
        creators.forEach(creator => {
            creatorMap[creator.id] = creator.nickname;
        });
        
        // 使用单独的查询获取每个聊天室的成员数量
        const roomIds = rooms.map(room => room.id);
        const memberCounts = await models.RoomMember.findAll({
            where: {
                room_id: {
                    [Sequelize.Op.in]: roomIds
                }
            },
            attributes: [
                'room_id',
                [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'memberCount']
            ],
            group: ['room_id']
        });
        
        // 创建成员数量映射
        const memberCountMap = {};
        memberCounts.forEach(count => {
            memberCountMap[count.get('room_id')] = parseInt(count.get('memberCount'));
        });
        
        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            creatorNickname: creatorMap[room.creator_id] || '未知',
            memberCount: memberCountMap[room.id] || 0,
            isPrivate: room.isPrivate
        }));
    } catch (error) {
        log('ERROR', '搜索聊天室失败: ' + error);
        throw error;
    }
};

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    getUserRooms,
    getRoomMembers,
    addMember,
    kickMember,
    setModerator,
    searchRooms
};