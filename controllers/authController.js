const models = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const { logUserLogin, logUserLogout } = require('../utils/logger');

// 登录
exports.login = async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body; // 添加rememberMe参数
        
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        
        // 验证输入
        if (!username || !password) {
            logUserLogin(clientIP, username, false, '用户名和密码不能为空');
            return res.status(400).json({ message: '用户名和密码不能为空' });
        }
        
        // 查找用户
        const user = await models.User.findOne({ where: { username } });
        if (!user) {
            logUserLogin(clientIP, username, false, '用户不存在');
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            logUserLogin(clientIP, username, false, '密码错误');
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
        
    // 计算Cookie过期时间：如果rememberMe为true则7天，否则24小时
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    // 将token写入Cookie（开发环境放宽安全限制）
    res.cookie('token', token, {
      httpOnly: false,
      secure: false,
      maxAge: maxAge,
      sameSite: 'lax'
    });
        
        // 存储token到数据库
        const expiresAt = new Date(Date.now() + maxAge);
        await models.Token.create({
          token: token,
          userId: user.id,
          expiresAt: expiresAt
        });
        
        // 记录成功登录日志
        logUserLogin(clientIP, username, true);
        
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
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        const username = req.body.username || 'unknown';
        logUserLogin(clientIP, username, false, '服务器内部错误');
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 注册
exports.register = async (req, res) => {
    try {
        const { username, nickname, password, confirmPassword, rememberMe } = req.body; // 添加rememberMe参数
        
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
        const existingUser = await models.User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ message: '用户名已存在' });
        }
        
        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await models.User.create({
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
        
    // 计算Cookie过期时间：如果rememberMe为true则7天，否则24小时
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    // 将token写入Cookie（开发环境放宽安全限制）
    res.cookie('token', token, {
      httpOnly: false,
      secure: false,
      maxAge: maxAge,
      sameSite: 'lax'
    });
        
        // 存储token到数据库
        const expiresAt = new Date(Date.now() + maxAge);
        await models.Token.create({
          token: token,
          userId: newUser.id,
          expiresAt: expiresAt
        });
        
        // 返回用户信息和token（新增token字段）
        res.json({
            message: '注册成功',
            token,
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
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        
        // 获取用户名
        const username = req.user ? req.user.username : 'unknown';
        
        // 清除token Cookie，使用与设置时相同的选项
        res.clearCookie('token', {
            httpOnly: false,
            secure: false,
            sameSite: 'lax'
        });
        
        // 从数据库中删除token记录
        const token = req.cookies.token;
        if (token) {
          await models.Token.destroy({ where: { token: token } });
        }
        
        // 记录退出登录日志
        logUserLogout(clientIP, username, true);
        
        // 返回成功响应
        res.json({ message: '退出登录成功' });
        
    } catch (error) {
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        const username = req.user ? req.user.username : 'unknown';
        logUserLogout(clientIP, username, false, '服务器内部错误');
        console.error('退出登录错误:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 新增token验证接口
exports.verifyToken = async (req, res) => {
  // 从cookie获取token
  const token = req.cookies.token;
  if (!token) {
    return res.status(403).json({ 
      valid: false,
      message: 'Token缺失',
      redirect: '/login'
    });
  }

  try {
    const decoded = jwt.verify(token, config.encryptionKey);
    res.json({ 
      valid: true, 
      user: {
        id: decoded.id,
        username: decoded.username,
        isAdmin: decoded.isAdmin
      }
    });
  } catch (err) {
    res.status(403).json({ 
      valid: false, 
      message: '无效的Token',
      redirect: '/login'
    });
  }
};
