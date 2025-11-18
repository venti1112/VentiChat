const { models } = require('../app');

// 获取所有用户（管理员）
exports.getAllUsers = async (req, res) => {
    try {
        const users = await models.User.findAll({
            attributes: ['id', 'username', 'nickname', 'status', 'created_at']
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 封禁/解封用户（管理员）
exports.banUser = async (req, res) => {
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