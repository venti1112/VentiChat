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
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
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
            process.env.ENCRYPTION_KEY || config.encryptionKey, // 使用环境变量优先，降级到配置文件
            { expiresIn: '24h' }
        );
        
        // 将token写入Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        // 返回用户信息和token（新增token字段）
        res.json({ 
            message: '登录成功',
            token, // 新增：将token包含在响应体中
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
            passwordHash: hashedPassword,
            avatarUrl: '/images/default-avatar.jpg' // 默认头像
        });
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                id: newUser.id, 
                username: newUser.username,
                isAdmin: newUser.isAdmin 
            }, 
            config.encryptionKey, 
            { expiresIn: '24h' }
        );
        
        // 将token写入Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        // 返回用户信息和token（新增token字段）
        res.json({
            message: '注册成功',
            token, // 新增：将token包含在响应体中
            user: {
                id: newUser.id,
                username: newUser.username,
                nickname: newUser.nickname,
                avatarUrl: newUser.avatarUrl,
                isAdmin: newUser.isAdmin
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 退出登录
exports.logout = async (req, res) => {
    try {
        // 对于JWT token，由于是无状态的，我们无法直接使token失效
        // 但可以记录token到黑名单（如果实现的话）或让前端清除本地存储
        // 这里简单返回成功，让前端清除本地存储
        
        res.json({ message: '退出登录成功' });
        
    } catch (error) {
        console.error('退出登录错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 新增token验证接口
exports.verifyToken = (req, res) => {
  const token = req.body.token;
  if (!token) {
    return res.status(403).json({ message: 'Token缺失' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ENCRYPTION_KEY || config.encryptionKey);
    res.json({ 
      valid: true, 
      user: {
        id: decoded.id,
        username: decoded.username,
        isAdmin: decoded.isAdmin
      }
    });
  } catch (err) {
    res.status(403).json({ valid: false, message: '无效的Token' });
  }
};
