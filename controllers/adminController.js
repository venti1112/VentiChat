const { models } = require('../app');

// 获取所有用户（管理员）
exports.getUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['id', 'username', 'nickname', 'status', 'created_at']
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 创建用户（管理员）
exports.createUser = async (req, res) => {
    try {
        const { username, nickname, password } = req.body;
        
        // 检查用户名是否已存在
        const existingUser = await models.User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 创建用户（这里需要密码加密，但为了简化先直接保存）
        const user = await models.User.create({
            username,
            nickname,
            password // 实际应用中应该加密
        });
        
        res.json({ message: '用户创建成功', user: { id: user.id, username: user.username, nickname: user.nickname } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户（管理员）
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { nickname, status } = req.body;
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.update({ nickname, status });
        
        res.json({ message: '用户信息已更新' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除用户（管理员）
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.destroy();
        
        res.json({ message: '用户已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 封禁/解封用户（管理员）
exports.toggleUserStatus = async (req, res) => {
    try {
        const { userId, action } = req.body; // action: 'ban' or 'unban'
        
        const user = await models.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        await user.update({
            status: action === 'ban' ? 'banned' : 'active'
        });
        
        res.json({ message: `用户已${action === 'ban' ? '封禁' : '解封'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 获取所有聊天室（管理员）
exports.getRooms = async (req, res) => {
    try {
        const rooms = await models.Room.findAll({
            attributes: ['id', 'name', 'type', 'created_at']
        });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 删除聊天室（管理员）
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        
        const room = await models.Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ error: '聊天室不存在' });
        }
        
        await room.destroy();
        
        res.json({ message: '聊天室已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
