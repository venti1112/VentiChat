const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { generateToken, removeToken, removeAllUserTokens } = require('../utils/auth');
const { logUserLogin, logUserLogout, log } = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config/config.json');

// 获取用户个人资料
exports.getProfile = async (req, res) => {
    try {
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 通过用户ID获取用户信息（供其他用户查询）
exports.getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const User = req.app.get('models').User;
        
        // 验证用户ID是否为数字
        if (!userId || isNaN(userId) || userId === 'undefined' || userId === 'null' || String(userId).trim() === '' || String(userId).trim() === 'undefined') {
            return res.status(400).json({ error: '无效的用户ID' });
        }
        
        const user = await User.findByPk(userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            id: user.userId,
            username: user.username,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl || '/default-avatar.png'
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 获取用户个性化设置
exports.getUserPreferences = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 通过req.app.get('models')获取User模型
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl', 'themeColor']
        });
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({
            backgroundUrl: user.backgroundUrl || '/wp.jpg',
            themeColor: user.themeColor || '#4cd8b8'
        });
    } catch (error) {
        console.error('获取用户偏好设置失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 强制退出登录（管理员功能）
exports.forceLogout = async (req, res) => {
    try {
        const { userId } = req.params;
        const clientIP = req.realIP || req.ip;
        
        // 移除用户的所有Tokens
        await removeAllUserTokens(userId);
        
        log('INFO', `管理员 ${req.user.username} 强制用户 ${userId} 退出登录 - IP: ${clientIP}`);
        
        res.json({ message: '用户已强制退出登录' });
    } catch (error) {
        log('ERROR', `强制用户退出登录错误: ${error.message}`);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

// 更新用户资料
exports.updateProfile = async (req, res) => {
    try {
        const { nickname } = req.body;
        
        // 准备更新数据
        const updateData = {
            nickname: nickname || req.user.nickname
        };
        
        // 如果有上传头像文件，则更新头像URL
        if (req.file) {
            updateData.avatarUrl = getAvatarUrl(req.file.filename);
        }
        
        const User = req.app.get('models').User;
        await User.update(
            updateData,
            {
                where: { userId: req.user.userId }
            }
        );
        
        // 获取更新后的用户信息
        const updatedUser = await User.findByPk(req.user.userId, {
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json({ 
            message: '资料更新成功',
            user: {
                id: updatedUser.userId,
                username: updatedUser.username,
                nickname: updatedUser.nickname,
                avatarUrl: updatedUser.avatarUrl || '/default-avatar.png'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 修改用户密码
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;
        
        // 参数验证
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '当前密码和新密码都是必填项' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码至少需要6位字符' });
        }
        
        const User = req.app.get('models').User;
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 验证当前密码
        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ error: '当前密码错误' });
        }
        
        // 检查新密码是否与旧密码相同
        const isNewPasswordSame = await bcrypt.compare(newPassword, user.passwordHash);
        if (isNewPasswordSame) {
            return res.status(400).json({ error: '新密码不能与当前密码相同' });
        }
        
        // 哈希新密码
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        
        // 更新密码
        await User.update(
            { passwordHash: newPasswordHash },
            { where: { userId: userId } }
        );
        
        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
};

// 搜索用户
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.json([]);
        }
        
        const User = req.app.get('models').User;
        const users = await User.findAll({
            where: {
                [Sequelize.Op.or]: [
                    { username: { [Sequelize.Op.like]: `%${query}%` } },
                    { nickname: { [Sequelize.Op.like]: `%${query}%` } }
                ]
            },
            attributes: ['userId', 'username', 'nickname', 'avatarUrl']
        });
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 更新用户偏好设置
exports.updateUserPreferences = async (req, res) => {
    try {
        const { backgroundUrl, themeColor } = req.body;
        
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 准备更新数据
        const updateData = {};
        if (backgroundUrl !== undefined) updateData.backgroundUrl = backgroundUrl;
        if (themeColor !== undefined) updateData.themeColor = themeColor;
        
        const User = req.app.get('models').User;
        const [updatedRowsCount] = await User.update(
            updateData,
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 获取更新后的用户偏好设置
        const updatedUser = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl', 'themeColor']
        });
        
        res.json({
            message: '偏好设置更新成功',
            preferences: {
                backgroundUrl: updatedUser.backgroundUrl || '/wp.jpg',
                themeColor: updatedUser.themeColor || '#4cd8b8'
            }
        });
    } catch (error) {
        console.error('更新用户偏好设置失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 上传背景图片
exports.uploadBackground = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 检查是否有上传文件
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }
        
        // 获取用户当前的背景图片URL
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl']
        });
        const oldBackgroundUrl = user?.backgroundUrl;

        // 构造新的背景图片URL
        const backgroundUrl = `/api/userdata/background/${req.file.filename}`;
        
        // 更新用户背景图片URL
        const [updatedRowsCount] = await User.update(
            { backgroundUrl },
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 删除旧的背景图片文件（如果存在且不是默认背景）
        if (oldBackgroundUrl && !oldBackgroundUrl.includes('wp.jpg')) {
            const oldBackgroundPath = path.join(__dirname, '..', 'public', oldBackgroundUrl);
            if (fs.existsSync(oldBackgroundPath)) {
                fs.unlinkSync(oldBackgroundPath);
            }
        }
        
        res.json({
            message: '背景图片上传成功',
            backgroundUrl
        });
    } catch (error) {
        console.error('上传背景图片失败:', error);
        res.status(500).json({ error: '内部服务器错误' });
    }
};

// 重置背景图片
exports.resetBackground = async (req, res) => {
    try {
        // 确保用户已通过认证
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        
        // 获取用户当前的背景图片URL
        const User = req.app.get('models').User;
        const user = await User.findByPk(req.user.userId, {
            attributes: ['backgroundUrl']
        });
        const oldBackgroundUrl = user?.backgroundUrl;

        // 更新用户背景图片URL为默认值
        const [updatedRowsCount] = await User.update(
            { backgroundUrl: '/api/userdata/background/wp.jpg' },
            {
                where: { userId: req.user.userId }
            }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 删除旧的背景图片文件（如果存在且不是默认背景）
        if (oldBackgroundUrl && !oldBackgroundUrl.includes('wp.jpg')) {
            const oldBackgroundPath = path.join(__dirname, '..', 'public', oldBackgroundUrl);
            if (fs.existsSync(oldBackgroundPath)) {
                fs.unlinkSync(oldBackgroundPath);
            }
        }
        
        res.json({ message: '背景图片已重置为默认' });
    } catch (error) {
        console.error('重置背景图片错误:', error);
        res.status(500).json({ error: '重置背景图片失败' });
    }
};