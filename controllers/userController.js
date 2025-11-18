const { models } = require('../app');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 用户登录
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await models.User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.ENCRYPTION_KEY || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 用户注册
exports.register = async (req, res) => {
    try {
        const { username, password, nickname } = req.body;
        
        // 检查用户名是否已存在
        const existingUser = await models.User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }
        
        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // 创建用户
        const user = await User.create({
            username,
            passwordHash,
            nickname: nickname || username
        });
        
        // 加入默认大聊天室
        const defaultRoom = await models.Room.findOne({ where: { name: '默认大聊天室' } });
        if (defaultRoom) {
            await models.RoomMember.create({
                userId: user.id,
                roomId: defaultRoom.id
            });
        }
        
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户资料
exports.updateProfile = async (req, res) => {
    try {
        const { nickname, avatarUrl } = req.body;
        
        await models.User.update(
            {
                nickname: nickname || req.user.nickname,
                avatarUrl: avatarUrl || req.user.avatarUrl
            },
            {
                where: { id: req.user.id }
            }
        );
        
        res.json({ message: '资料更新成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 搜索用户
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.json([]);
        }
        
        const users = await models.User.findAll({
            where: {
                [models.Sequelize.Op.or]: [
                    { username: { [models.Sequelize.Op.like]: `%${query}%` } },
                    { nickname: { [models.Sequelize.Op.like]: `%${query}%` } }
                ]
            },
            attributes: ['id', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};