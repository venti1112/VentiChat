const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const { log } = require('./logger');

// 用户注册
const register = async (userData) => {
    try {
        // 检查用户名是否已存在
        const existingUser = await User.findOne({
            where: { username: userData.username }
        });
        
        if (existingUser) {
            throw new Error('用户名已存在');
        }
        
        // 加密密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        // 创建用户
        const user = await User.create({
            username: userData.username,
            nickname: userData.nickname || userData.username,
            passwordHash: hashedPassword,
            avatarUrl: userData.avatarUrl,
            status: 'active'
        });
        
        // 自动加入默认大聊天室
        await RoomMember.create({
            userId: user.id,
            roomId: 1, // 默认大聊天室RID
            isModerator: false
        });
        
        return user;
    } catch (error) {
        log('ERROR', `用户注册失败: ` + error);
        throw error;
    }
};

// 用户登录
const login = async (username, password) => {
    try {
        log('INFO', `开始登录流程，用户名: ${username}`);
        
        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            log('ERROR', `用户不存在: ${username}`);
            throw new Error('用户名或密码错误');
        }
        
        log('INFO', `找到用户，检查状态: ${user.status}`);
        if (user.status === 'banned') {
            throw new Error('该账户已被封禁');
        }
        
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        log('INFO', `密码验证结果: ${isMatch}`);
        
        if (!isMatch) {
            throw new Error('用户名或密码错误');
        }
        
        // 检查配置
        if (!config.encryptionKey) {
            log('ERROR', 'JWT密钥未配置');
            throw new Error('系统配置错误');
        }
        
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            config.encryptionKey,
            { expiresIn: '7d' }
        );
        
        log('INFO', `Token生成成功，长度: ${token.length}`);
        
        return {
            token: token,
            user: {
                id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                status: user.status
            }
        };
    } catch (error) {
        log('ERROR', `用户登录失败: ${error.message}`);
        throw error;
    }
};

// 获取用户信息
const getUserInfo = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'nickname', 'avatarUrl', 'status', 'createdAt']
        });
        
        if (!user) {
            throw new Error('用户不存在');
        }
        
        return user;
    } catch (error) {
        log('ERROR', `获取用户信息失败: ${error}`);
        throw error;
    }
};

// 更新用户信息
const updateUserInfo = async (userId, updateData) => {
    try {
        const user = await User.findByPk(userId);
        
        if (!user) {
            throw new Error('用户不存在');
        }
        
        // 更新昵称
        if (updateData.nickname !== undefined) {
            user.nickname = updateData.nickname;
        }
        
        // 更新头像
        if (updateData.avatarUrl !== undefined) {
            user.avatarUrl = updateData.avatarUrl;
        }
        
        // 更新密码
        if (updateData.newPassword !== undefined) {
            // 验证当前密码（如果提供了）
            if (updateData.currentPassword) {
                const isMatch = await bcrypt.compare(updateData.currentPassword, user.passwordHash);
                if (!isMatch) {
                    throw new Error('当前密码错误');
                }
            }
            
            // 加密新密码
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(updateData.newPassword, salt);
        }
        
        await user.save();
        
        return {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            status: user.status
        };
    } catch (error) {
        log('ERROR', `更新用户信息失败: ` + error);
        throw error;
    }
};

// 搜索用户
const searchUsers = async (query) => {
    try {
        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { username: { [Sequelize.Op.like]: `%${query}%` } },
                    { nickname: { [Sequelize.Op.like]: `%${query}%` } },
                    { id: parseInt(query) || 0 }
                ],
                status: 'active'
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl'],
            limit: 20
        });
        
        return users.map(user => ({
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl
        }));
    } catch (error) {
        log('ERROR', `搜索用户失败: ` + error);
        throw error;
    }
};

// 创建私聊
const createPrivateChat = async (userId1, userId2) => {
    try {
        // 检查用户是否存在
        const user1 = await User.findByPk(userId1);
        const user2 = await User.findByPk(userId2);
        
        if (!user1 || !user2) {
            throw new Error('用户不存在');
        }
        
        // 检查是否已经存在私聊
        const existingRoom = await Room.findOne({
            include: [
                {
                    model: User,
                    through: { attributes: [] },
                    where: { id: [userId1, userId2] }
                }
            ],
            having: Sequelize.fn('COUNT', Sequelize.col('Users.id')) >= 2
        });
        
        if (existingRoom) {
            return existingRoom;
        }
        
        // 创建私聊聊天室
        const roomName = `私聊_${userId1}_${userId2}`;
        const room = await Room.create({
            name: roomName,
            creatorId: userId1, // 任意设置一个创建者
            isPrivate: true,
            requireApproval: false, // 私聊不需要审核
            allowImages: true,
            allowVideos: true,
            allowFiles: true,
            retentionDays: 180
        });
        
        // 添加两个用户并都设为室主（通过管理员权限实现）
        await RoomMember.create({
            userId: userId1,
            roomId: room.id,
            isModerator: true
        });
        
        await RoomMember.create({
            userId: userId2,
            roomId: room.id,
            isModerator: true
        });
        
        return room;
    } catch (error) {
        log('ERROR', `创建私聊失败: ` + error);
        throw error;
    }
};

// 获取用户的备注设置
const getUserRoomNote = async (userId, roomId) => {
    try {
        const member = await RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        return member ? member.note : null;
    } catch (error) {
        log('ERROR', `获取用户备注失败: ` + error);
        throw error;
    }
};

// 设置用户的备注
const setUserRoomNote = async (userId, roomId, note) => {
    try {
        const member = await RoomMember.findOne({
            where: {
                userId: userId,
                roomId: roomId
            }
        });
        
        if (!member) {
            throw new Error('您不是该聊天室的成员');
        }
        
        member.note = note;
        await member.save();
        
        return { success: true };
    } catch (error) {
        log('ERROR', `设置用户备注失败: ` + error);
        throw error;
    }
};

module.exports = {
    register,
    login,
    getUserInfo,
    updateUserInfo,
    searchUsers,
    createPrivateChat,
    getUserRoomNote,
    setUserRoomNote
};