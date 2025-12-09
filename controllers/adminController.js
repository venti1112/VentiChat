const models = require('../models');
const { log } = require('../utils/logger');

// 获取所有用户（管理员）
exports.getUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['userId', 'username', 'nickname', 'status', 'createdAt']
        });
        
        // 格式化返回数据，确保字段名与前端一致，并简化状态信息
        const formattedUsers = users.map(user => ({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            status: user.status === 1 ? 'active' : 'inactive', // 将数字状态转换为可读的状态
            createdAt: user.createdAt,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        }));
        
        res.json(formattedUsers);
    } catch (error) {
        log('ERROR', `获取用户列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 更新用户信息（管理员）
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, nickname, status } = req.body;
        
        // 查找用户
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 更新用户信息
        await user.update({
            username,
            nickname,
            status
        });
        
        res.json({ message: '用户信息更新成功' });
    } catch (error) {
        log('ERROR', `更新用户信息失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 删除用户（管理员）
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 检查用户是否存在
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 删除用户
        await models.User.destroy({
            where: { userId }
        });
        
        res.json({ message: '用户删除成功' });
    } catch (error) {
        log('ERROR', `删除用户失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 更新用户状态（管理员）
exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        
        // 检查用户是否存在
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 更新用户状态
        await user.update({ status });
        
        res.json({ message: '用户状态更新成功' });
    } catch (error) {
        log('ERROR', `更新用户状态失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 获取所有聊天室（管理员）
exports.getRooms = async (req, res) => {
    try {
        const rooms = await models.Room.findAll();
        
        // 为每个房间添加成员数量
        const roomsWithMemberCount = await Promise.all(rooms.map(async (room) => {
            const memberCount = await models.RoomMember.count({
                where: { roomId: room.roomId }
            });
            
            return {
                ...room.toJSON(),
                memberCount: memberCount
            };
        }));
        
        res.json(roomsWithMemberCount);
    } catch (error) {
        log('ERROR', `获取聊天室列表失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（管理员）
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 查找房间
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        // 删除房间及相关数据
        await room.destroy();
        
        res.json({ message: '聊天室删除成功' });
    } catch (error) {
        log('ERROR', `删除聊天室失败: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};
