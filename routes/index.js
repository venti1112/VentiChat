const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadSingle } = require('../utils/fileUpload');

// 配置multer用于头像上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/userdata/avatar/');
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 创建public/userdata/avatar目录（如果不存在）
const fs = require('fs');
const avatarDir = 'public/userdata/avatar';
if (!fs.existsSync(avatarDir)){
  fs.mkdirSync(avatarDir, { recursive: true });
}

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制文件大小为5MB
  },
  fileFilter: function (req, file, cb) {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 引入中间件
const authMiddleware = require('../middleware/authMiddleware').authMiddleware;
const { messageRateLimiter } = require('../middleware/messageRateLimiter');
const { loginRateLimiter, registerRateLimiter } = require('../middleware/authRateLimiter');

// 创建用于背景图上传的 multer 实例
const backgroundStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/userdata/background');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bg-' + req.user.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const backgroundUpload = multer({ 
  storage: backgroundStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制文件大小为10MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 确保背景图目录存在
const backgroundDir = 'public/userdata/background';
if (!fs.existsSync(backgroundDir)){
  fs.mkdirSync(backgroundDir, { recursive: true });
}

// 认证相关路由
const authController = require('../controllers/authController');
// 用户登录接口 - 验证用户凭据并返回访问令牌
router.post('/auth/login', loginRateLimiter, authController.login);
// 用户注册接口 - 创建新用户账户，可同时上传头像
router.post('/auth/register', registerRateLimiter, upload.single('avatar'), authController.register);
// 用户登出接口 - 注销当前用户的会话
router.get('/auth/logout', authMiddleware, authController.logout);
// 验证令牌接口 - 验证JWT访问令牌的有效性
router.get('/auth/verify', authController.verifyToken);

// 用户相关路由
const userController = require('../controllers/userController');
// 上传用户背景图片 - 允许用户上传个人资料背景图
router.post('/users/upload-background', authMiddleware, backgroundUpload.single('background'), userController.uploadBackground);
// 重置用户背景图片 - 将用户背景图恢复为默认设置
router.get('/users/reset-background', authMiddleware, userController.resetBackground);
// 更新用户偏好设置 - 修改用户的界面偏好和其他设置
router.put('/users/preferences', authMiddleware, userController.updateUserPreferences);
// 更新用户资料 - 修改用户名、邮箱等个人信息
router.put('/users/profile', authMiddleware, userController.updateProfile);
// 获取用户偏好设置 - 获取当前用户的界面偏好和其他设置
router.get('/users/preferences', authMiddleware, userController.getUserPreferences);
// 获取当前用户的头像URL - 返回当前登录用户的头像图片地址
router.get('/users/avatar', authMiddleware, userController.getAvatarUrl);
// 根据用户ID获取用户资料 - 获取指定用户的公开信息
router.get('/users/profile/:userId', authMiddleware, userController.getUserById);
// 获取指定用户的头像URL - 返回特定用户的头像图片地址
router.get('/users/:userId/avatar', authMiddleware, userController.getAvatarUrl);

// 聊天室相关路由
const roomController = require('../controllers/roomController');
// 获取聊天室列表 - 返回用户可访问的所有聊天室
router.get('/rooms', authMiddleware, roomController.getRooms);
// 创建聊天室 - 创建一个新的公共或私有聊天室
router.post('/rooms', authMiddleware, roomController.createRoom);
// 创建私人聊天室 - 创建一个仅供两个用户使用的私人聊天室
router.post('/rooms/private', authMiddleware, roomController.createPrivateRoom);

// 获取聊天室成员列表 - 返回指定聊天室的所有成员信息
router.get('/rooms/:roomId/members', authMiddleware, roomController.getRoomMembers);
// 获取聊天室成员ID列表 - 返回指定聊天室所有成员的用户ID
router.get('/rooms/:roomId/member-ids', authMiddleware, roomController.getRoomMemberIds);
// 根据用户ID列表获取用户信息 - 批量获取多个用户的基本信息
router.post('/users/by-ids', authMiddleware, roomController.getUsersByIds);
// 获取聊天室详情 - 返回指定聊天室的详细信息
router.get('/rooms/:id', authMiddleware, roomController.getRoom);
// 踢出聊天室成员 - 从指定聊天室中移除某个成员
router.delete('/rooms/:roomId/members/:userId', authMiddleware, roomController.kickMember);
// 发送加入聊天室请求 - 向需要审批的聊天室发送加入申请
router.post('/rooms/:id/join-request', authMiddleware, roomController.sendJoinRequest);
// 获取待处理的加入请求 - 获取指定聊天室中所有待审批的加入请求
router.get('/rooms/:id/pending-requests', authMiddleware, roomController.getPendingRequests);
// 批准加入聊天室请求 - 同意用户的聊天室加入申请
router.post('/rooms/:id/approve-join-request', authMiddleware, roomController.approveJoinRequest);
// 更新聊天室设置 - 修改聊天室的名称、描述等设置
router.put('/rooms/:id/settings', authMiddleware, roomController.updateRoomSettings);
// 设置聊天室成员角色 - 修改聊天室中成员的角色（如设为管理员）
router.put('/rooms/:roomId/members/:userId/role', authMiddleware, roomController.setMemberRole);

// 消息相关路由
const messageController = require('../controllers/messageController');
// 获取聊天室消息历史记录 - 返回指定聊天室的历史消息（按房间ID在URL路径中）
router.get('/messages/history/:roomId', authMiddleware, messageController.getMessageHistory);
// 获取聊天室消息历史记录 - 返回指定聊天室的历史消息（按房间ID在URL参数中）
router.get('/messages/:roomId/history', authMiddleware, messageController.getMessageHistory);
// 获取聊天室消息 - 返回指定聊天室的最新消息
router.get('/messages/:roomId', authMiddleware, messageController.getRoomMessages);
// 应用速率限制中间件到发送消息的路由
// 发送消息 - 向指定聊天室发送新消息
router.post('/messages', authMiddleware, messageRateLimiter, messageController.sendMessage);
// 撤回消息 - 撤回已发送但仍在可撤回时间内的消息
router.put('/messages/:messageId/retract', authMiddleware, messageController.recallMessage);

// 文件相关路由
const fileController = require('../controllers/fileController');
// 上传图片消息 - 允许用户在聊天中发送图片文件
router.post('/messages/image', authMiddleware, uploadSingle('file', 'image'), fileController.handleUpload);
// 上传视频消息 - 允许用户在聊天中发送视频文件
router.post('/messages/video', authMiddleware, uploadSingle('file', 'video'), fileController.handleUpload);
// 上传文件消息 - 允许用户在聊天中发送任意类型文件
router.post('/messages/file', authMiddleware, uploadSingle('file', 'file'), fileController.handleUpload);

// 文件上传路由
// 上传图片 - 通用图片上传接口
router.post('/upload/image', authMiddleware, uploadSingle('file', 'image'), fileController.handleUpload);
// 初始化分块上传 - 开始一个大文件的分块上传过程
router.post('/upload/initiate', authMiddleware, fileController.initiateChunkedUpload);
// 上传文件块 - 上传大文件的一个数据块
router.post('/upload/chunk', authMiddleware, uploadSingle('chunk', 'chunk'), fileController.uploadChunk);
// 完成分块上传 - 完成所有文件块的上传并组合成完整文件
router.post('/upload/complete', authMiddleware, fileController.completeChunkedUpload);
// 清理分块上传 - 清理上传过程中产生的临时文件
router.post('/upload/cleanup', authMiddleware, fileController.cleanupChunkedUpload);
// 初始化分块消息上传 - 开始一个大文件消息的分块上传过程
router.post('/messages/chunked/initiate', authMiddleware, fileController.initiateChunkedUpload);
// 上传消息文件块 - 上传大文件消息的一个数据块
router.post('/messages/chunked/upload', authMiddleware, uploadSingle('chunk', 'chunk'), fileController.uploadChunk);
// 完成分块消息上传 - 完成所有消息文件块的上传并组合成完整文件
router.post('/messages/chunked/complete', authMiddleware, fileController.completeChunkedUpload);

// 搜索聊天室和用户 - 根据关键词搜索公开的聊天室和用户
router.get('/search', authMiddleware, roomController.searchRooms);

// 管理后台路由
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/authMiddleware').adminMiddleware;
// 获取所有用户列表 - 管理员查看系统中所有用户的信息
router.get('/admin/users', adminMiddleware, adminController.getUsers);
// 创建用户 - 管理员手动创建新用户
router.post('/admin/users', adminMiddleware, adminController.createUser);
// 更新用户信息 - 管理员修改指定用户的信息
router.put('/admin/users/:userId', adminMiddleware, adminController.updateUser);
// 删除用户 - 管理员删除指定用户
router.delete('/admin/users/:userId', adminMiddleware, adminController.deleteUser);
// 更新用户状态 - 管理员更改用户账户状态（如启用/禁用）
router.put('/admin/users/:userId/status', adminMiddleware, adminController.updateUserStatus);
// 获取所有聊天室列表 - 管理员查看系统中所有聊天室的信息
router.get('/admin/rooms', adminMiddleware, adminController.getRooms);
// 获取聊天室详情 - 管理员查看指定聊天室的详细信息
router.get('/admin/rooms/:id', adminMiddleware, adminController.getRoom);
// 获取聊天室成员列表 - 管理员查看指定聊天室的所有成员信息
router.get('/admin/rooms/:id/members', adminMiddleware, adminController.getRoomMembers);
// 删除聊天室 - 管理员删除指定聊天室
router.delete('/admin/rooms/:id', adminMiddleware, adminController.deleteRoom);

module.exports = router;