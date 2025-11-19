const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');

// 登录
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({ message: '用户名和密码不能为空' });
        }
        
        // 查找用户
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username,
                isAdmin: user.isAdmin 
            }, 
            config.encryptionKey, 
            { expiresIn: '24h' }
        );
        
        // 返回token和用户信息（排除敏感信息）
        res.json({ 
            token, 
            user: {
                id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                isAdmin: user.isAdmin
            }
        });
        
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 注册
exports.register = async (req, res) => {
    try {
        const { username, nickname, password, confirmPassword } = req.body;
        
        // 前端验证（后端也要验证）
        if (!username || !nickname || !password || !confirmPassword) {
            return res.status(400).json({ message: '所有字段都必须填写' });
        }
        
        if (password !== confirmPassword) {
            return res.status(400).json({ message: '两次输入的密码不一致' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: '密码至少需要6位字符' });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ message: '用户名已存在' });
        }
        
        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username,
            nickname,
            password: hashedPassword,
            avatarUrl: '/images/default-avatar.jpg' // 默认头像
        });
        
        res.status(201).json({ message: '注册成功，请登录' });
        
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};
