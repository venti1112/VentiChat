const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const { hashPassword, comparePassword } = require('../utils/auth');
const { generateToken, verifyToken } = require('../utils/jwt');
const { log, logUserLogin, logUserLogout } = require('../utils/logger');

// 修复：正确导入User模型
const { User, Token } = require('../models/index');

// 登录
exports.login = async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body; // 添加rememberMe参数
        
        // 获取客户端IP
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
        
        // 验证输入
        if (!username || !password) {
            logUserLogin(clientIP, username, false, '用户名和密码不能为空');
            return res.status(400).json({ message: '用户名和密码不能为空' });
        }
        
        // 查找用户
        const user = await User.findOne({ where: { username } });
        if (!user) {
            logUserLogin(clientIP, username, false, '用户不存在');
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 检查用户状态
        if (user.status === 'banned') {
            logUserLogin(clientIP, username, false, '用户已被封禁');
            return res.status(403).json({ message: '用户已被封禁，无法登录' });
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
        await Token.create({
            token: token,
            userId: user.id,
            expiresAt: expiresAt
        });
        
        // 记录登录日志
        logUserLogin(clientIP, username, true);
        
        // 返回用户信息和token
        res.json({
            message: '登录成功',
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
        log('ERROR', '登录错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 注册
exports.register = async (req, res) => {
    try {
        const { username, nickname, password, confirmPassword } = req.body;
        let avatarUrl = '/default-avatar.png'; // 默认头像路径
        
        // 验证输入
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
        
        // 如果有上传头像文件，则使用上传的头像
        if (req.file) {
            avatarUrl = `/userdata/avatar/${req.file.filename}`;
        }
        
        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username,
            nickname,
            passwordHash: hashedPassword,
            avatarUrl: avatarUrl
        });

        // 获取大厅房间（VentiChat大厅）
        const hallRoom = await require('../models').Room.findOne({
            where: {
                name: 'VentiChat大厅'
            }
        });

        // 如果大厅房间存在，将新用户加入其中
        if (hallRoom) {
            await require('../models').RoomMember.create({
                user_id: newUser.id,
                room_id: hallRoom.id,
                is_moderator: false
            });
        }

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
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 注册后默认7天
        
        // 将token写入Cookie（开发环境放宽安全限制）
        res.cookie('token', token, {
          httpOnly: false,
          secure: false,
          maxAge: maxAge,
          sameSite: 'lax'
        });
        
        // 存储token到数据库
        const expiresAt = new Date(Date.now() + maxAge);
        await Token.create({
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
        log('ERROR', '注册错误: ' + error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

// 退出登录
exports.logout = async (req, res) => {
    // 获取客户端IP
    const clientIP = req.ip || req.connection.remoteAddress || 
                    (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
    
    // 初始化用户名为未知用户
    let username = '未知用户';
    
    try {
        // 从cookie中获取token
        const token = req.cookies.token;
        
        // 如果存在token，则尝试解析用户名
        if (token) {
            try {
                const decoded = jwt.verify(token, config.encryptionKey);
                username = decoded.username || '未知用户';
            } catch (tokenError) {
                // token无效，使用默认值
                log('ERROR', 'Token解析错误: ' + tokenError.message);
            }
            
            // 从数据库中删除token
            await Token.destroy({ where: { token: token } });
        }
        
        // 清除token Cookie
        res.clearCookie('token', {
            httpOnly: false,
            secure: false,
            sameSite: 'lax'
        });
        
        // 记录退出登录日志
        logUserLogout(clientIP, username, true);
        
        // 返回成功响应
        res.json({ message: '退出登录成功' });
        
    } catch (error) {
        // 记录错误日志
        logUserLogout(clientIP, username, false, '服务器内部错误: ' + error.message);
        log('ERROR', '退出登录错误: ' + error.message);
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
    
    // 获取完整的用户信息
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(403).json({ 
        valid: false,
        message: '用户不存在',
        redirect: '/login'
      });
    }
    
    res.json({ 
      valid: true, 
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin
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