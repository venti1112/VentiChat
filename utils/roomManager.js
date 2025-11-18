const { Room, User, RoomMember } = require('../app');

// 创建聊天室
const createRoom = async (creatorId, roomData) => {
    try {
        // 验证创建者存在
        const creator = await User.findByPk(creatorId);
        if (!creator) {
            throw new Error('创建者不存在');
        }
        
        // 创建聊天室
        const room = await Room.create({
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
        await RoomMember.create({
            userId: creatorId,
            roomId: room.id,
            isModerator: true
        });
        
        return room;
    } catch (error) {
        console.error('创建聊天室失败:', error);
        throw error;
    }
};

// 加入聊天室
const joinRoom = async (userId, roomId, isAdminAction = false) => {
    try {
        const user = await User.findByPk(userId);
        const room = await Room.findByPk(roomId);
        
        if (!user) {
            throw new Error('用户不存在');
        }
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查是否已经是成员
        const existingMember = await RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (existingMember) {
            throw new Error('您已经是该聊天室的成员');
        }
        
        // 如果是私聊，检查成员数
        if (room.isPrivate) {
            const memberCount = await RoomMember.count({
                where: { roomId: roomId }
            });
            
            if (memberCount >= 2) {
                throw new Error('私聊聊天室已满');
            }
        }
        
        // 检查是否需要审核
        if (room.requireApproval && !isAdminAction) {
            // 这里应该创建一个加入申请
            // 简化实现：直接拒绝
            throw new Error('加入此聊天室需要管理员审核');
        }
        
        // 加入聊天室
        await RoomMember.create({
            userId: userId,
            roomId: roomId,
            isModerator: false
        });
        
        return { success: true };
    } catch (error) {
        console.error('加入聊天室失败:', error);
        throw error;
    }
};

// 退出聊天室
const leaveRoom = async (userId, roomId) => {
    try {
        const room = await Room.findByPk(roomId);
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查是否是默认大聊天室
        if (roomId === 1) {
            throw new Error('默认大聊天室不能退出');
        }
        
        // 检查是否是室主
        if (room.creatorId === userId) {
            throw new Error('室主不能退出聊天室，请先解散或转让室主');
        }
        
        // 移除成员关系
        const result = await RoomMember.destroy({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (result === 0) {
            throw new Error('您不是该聊天室的成员');
        }
        
        return { success: true };
    } catch (error) {
        console.error('退出聊天室失败:', error);
        throw error;
    }
};

// 解散聊天室
const deleteRoom = async (roomId, userId) => {
    try {
        const room = await Room.findByPk(roomId);
        
        if (!room) {
            throw new Error('聊天室不存在');
        }
        
        // 检查是否是默认大聊天室
        if (roomId === 1) {
            throw new Error('默认大聊天室不能被解散');
        }
        
        // 检查是否有权限解散（必须是室主）
        if (room.creatorId !== userId) {
            throw new Error('只有室主可以解散聊天室');
        }
        
        // 删除聊天室（级联删除相关记录）
        await room.destroy();
        
        return { success: true };
    } catch (error) {
        console.error('解散聊天室失败:', error);
        throw error;
    }
};

// 获取用户的所有聊天室
const getUserRooms = async (userId) => {
    try {
        const rooms = await Room.findAll({
            include: [
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['nickname']
                },
                {
                    model: User,
                    through: { attributes: ['note'] },
                    where: { id: userId }
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            note: room.Users[0].RoomMember.note,
            isPrivate: room.isPrivate,
            creatorNickname: room.Creator.nickname,
            memberCount: room.Users.length,
            createdAt: room.createdAt
        }));
    } catch (error) {
        console.error('获取用户聊天室失败:', error);
        throw error;
    }
};

// 获取聊天室成员列表
const getRoomMembers = async (roomId) => {
    try {
        const members = await RoomMember.findAll({
            where: { roomId: roomId },
            include: [
                {
                    model: User,
                    attributes: ['id', 'nickname', 'avatarUrl']
                }
            ],
            order: [['joinTime', 'ASC']]
        });
        
        return members.map(member => ({
            id: member.User.id,
            nickname: member.User.nickname,
            avatarUrl: member.User.avatarUrl,
            isModerator: member.isModerator,
            joinTime: member.joinTime
        }));
    } catch (error) {
        console.error('获取聊天室成员失败:', error);
        throw error;
    }
};

// 添加成员（由管理员或室主操作）
const addMember = async (operatorId, roomId, targetUserId) => {
    try {
        const operator = await User.findByPk(operatorId);
        const targetUser = await User.findByPk(targetUserId);
        const room = await Room.findByPk(roomId);
        
        if (!operator || !targetUser || !room) {
            throw new Error('用户或聊天室不存在');
        }
        
        // 检查操作者是否有权限（室主或室管）
        const operatorMember = await RoomMember.findOne({
            where: {
                userId: operatorId,
                roomId: roomId
            }
        });
        
        if (!operatorMember || !(operatorMember.isModerator || room.creatorId === operatorId)) {
            throw new Error('您没有权限添加成员');
        }
        
        // 检查目标用户是否已在聊天室中
        const existingMember = await RoomMember.findOne({
            where: {
                userId: targetUserId,
                roomId: roomId
            }
        });
        
        if (existingMember) {
            throw new Error('该用户已是聊天室成员');
        }
        
        // 添加成员
        await RoomMember.create({
            userId: targetUserId,
            roomId: roomId,
            isModerator: false
        });
        
        return { success: true };
    } catch (error) {
        console.error('添加成员失败:', error);
        throw error;
    }
};

// 踢出成员（由管理员或室主操作）
const kickMember = async (operatorId, roomId, targetUserId) => {
    try {
        const operator = await User.findByPk(operatorId);
        const targetUser = await User.findByPk(targetUserId);
        const room = await Room.findByPk(roomId);
        
        if (!operator || !targetUser || !room) {
            throw new Error('用户或聊天室不存在');
        }
        
        // 检查操作者是否有权限（室主或室管）
        const operatorMember = await RoomMember.findOne({
            where: {
                userId: operatorId,
                roomId: roomId
            }
        });
        
        if (!operatorMember || !(operatorMember.isModerator || room.creatorId === operatorId)) {
            throw new Error('您没有权限踢出成员');
        }
        
        // 检查目标用户是否在聊天室中
        const targetMember = await RoomMember.findOne({
            where: {
                userId: targetUserId,
                roomId: roomId
            }
        });
        
        if (!targetMember) {
            throw new Error('该用户不是聊天室成员');
        }
        
        // 检查是否是室主
        if (room.creatorId === targetUserId) {
            throw new Error('不能踢出室主');
        }
        
        // 踢出成员
        await targetMember.destroy();
        
        return { success: true };
    } catch (error) {
        console.error('踢出成员失败:', error);
        throw error;
    }
};

// 设置成员为管理员
const setModerator = async (operatorId, roomId, targetUserId, isModerator) => {
    try {
        const operator = await User.findByPk(operatorId);
        const targetUser = await User.findByPk(targetUserId);
        const room = await Room.findByPk(roomId);
        
        if (!operator || !targetUser || !room) {
            throw new Error('用户或聊天室不存在');
        }
        
        // 检查操作者是否有权限（必须是室主）
        if (room.creatorId !== operatorId) {
            throw new Error('只有室主可以设置管理员');
        }
        
        // 检查目标用户是否在聊天室中
        const targetMember = await RoomMember.findOne({
            where: {
                userId: targetUserId,
                roomId: roomId
            }
        });
        
        if (!targetMember) {
            throw new Error('该用户不是聊天室成员');
        }
        
        // 更新管理员状态
        targetMember.isModerator = isModerator;
        await targetMember.save();
        
        return { success: true };
    } catch (error) {
        console.error('设置管理员失败:', error);
        throw error;
    }
};

// 搜索聊天室
const searchRooms = async (query) => {
    try {
        const rooms = await Room.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { name: { [Sequelize.Op.like]: `%${query}%` } },
                    { id: parseInt(query) || 0 }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['nickname']
                }
            ],
            limit: 20
        });
        
        return rooms.map(room => ({
            id: room.id,
            name: room.name,
            creatorNickname: room.Creator.nickname,
            memberCount: room.Users.length,
            isPrivate: room.isPrivate
        }));
    } catch (error) {
        console.error('搜索聊天室失败:', error);
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