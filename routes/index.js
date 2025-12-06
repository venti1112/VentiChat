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

// 用户相关路由
const authController = require('../controllers/authController');
router.post('/auth/login', loginRateLimiter, authController.login);
router.post('/auth/register', registerRateLimiter, upload.single('avatar'), authController.register);
router.post('/auth/logout', authMiddleware, authController.logout);
router.get('/auth/logout', authMiddleware, authController.logout);  // 添加对GET方法的支持
router.get('/auth/verify', authController.verifyToken);
const userController = require('../controllers/userController');
router.get('/users/preferences', authMiddleware, userController.getUserPreferences);
router.put('/users/preferences', authMiddleware, userController.updateUserPreferences);
router.post('/users/upload-background', authMiddleware, backgroundUpload.single('background'), userController.uploadBackground);
router.post('/users/reset-background', authMiddleware, userController.resetBackground);
router.put('/users/profile', authMiddleware, userController.updateProfile);
router.get('/users/profile/:userId', authMiddleware, userController.getUserById);
router.get('/users/search', authMiddleware, userController.searchUsers);
router.get('/users/:userId/avatar', authMiddleware, userController.getAvatarUrl);
router.get('/users/avatar', authMiddleware, userController.getAvatarUrl);

// 添加缺失的路由别名，以支持 /api/user/profile 路径
router.put('/user/profile', authMiddleware, userController.updateProfile);

// 聊天室相关路由
const roomController = require('../controllers/roomController');
router.get('/rooms', authMiddleware, roomController.getRooms);
router.post('/rooms', authMiddleware, roomController.createRoom);
router.post('/rooms/private', authMiddleware, roomController.createPrivateRoom);
router.get('/rooms/search', authMiddleware, roomController.searchRooms);
router.get('/rooms/:roomId/members', authMiddleware, roomController.getRoomMembers);
router.get('/rooms/:roomId/member-ids', authMiddleware, roomController.getRoomMemberIds);
router.post('/users/by-ids', authMiddleware, roomController.getUsersByIds);
router.get('/rooms/:id', authMiddleware, roomController.getRoom);
router.delete('/rooms/:roomId/members/:userId', authMiddleware, roomController.kickMember);
// 新增加入请求相关路由
router.post('/rooms/:id/join-request', authMiddleware, roomController.sendJoinRequest);
router.get('/rooms/:id/pending-requests', authMiddleware, roomController.getPendingRequests);
router.post('/rooms/:id/approve-join-request', authMiddleware, roomController.approveJoinRequest);
// 添加更新聊天室设置的路由
router.put('/rooms/:id/settings', authMiddleware, roomController.updateRoomSettings);
// 添加设置成员角色的路由
router.put('/rooms/:roomId/members/:userId/role', authMiddleware, roomController.setMemberRole);

// 消息相关路由
const messageController = require('../controllers/messageController');
router.get('/messages/history/:roomId', authMiddleware, messageController.getMessageHistory);
router.get('/messages/:roomId/history', authMiddleware, messageController.getMessageHistory);
router.get('/messages/:roomId', authMiddleware, messageController.getRoomMessages);
// 应用速率限制中间件到发送消息的路由
router.post('/messages', authMiddleware, messageRateLimiter, messageController.sendMessage);
router.put('/messages/:messageId/retract', authMiddleware, messageController.recallMessage);

// 文件相关路由
const fileController = require('../controllers/fileController');
router.post('/messages/image', authMiddleware, uploadSingle('file', 'image'), fileController.handleUpload);
router.post('/messages/video', authMiddleware, uploadSingle('file', 'video'), fileController.handleUpload);
router.post('/messages/file', authMiddleware, uploadSingle('file', 'file'), fileController.handleUpload);

// 添加缺失的文件上传路由
router.post('/upload/image', authMiddleware, uploadSingle('file', 'image'), fileController.handleUpload);

// 添加缺失的上传初始化路由
router.post('/upload/initiate', authMiddleware, fileController.initiateChunkedUpload);

// 添加缺失的分片上传路由
router.post('/upload/chunk', authMiddleware, uploadSingle('chunk', 'chunk'), fileController.uploadChunk);

// 添加缺失的分片完成路由
router.post('/upload/complete', authMiddleware, fileController.completeChunkedUpload);

// 添加清理上传文件块路由
router.post('/upload/cleanup', authMiddleware, fileController.cleanupChunkedUpload);

// 分片上传路由
router.post('/messages/chunked/initiate', authMiddleware, fileController.initiateChunkedUpload);
router.post('/messages/chunked/upload', authMiddleware, uploadSingle('chunk', 'chunk'), fileController.uploadChunk);
router.post('/messages/chunked/complete', authMiddleware, fileController.completeChunkedUpload);

// 管理后台路由
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/authMiddleware').adminMiddleware;
router.get('/admin/users', adminMiddleware, adminController.getUsers);
router.post('/admin/users', adminMiddleware, adminController.createUser);
router.put('/admin/users/:userId', adminMiddleware, adminController.updateUser);
router.delete('/admin/users/:userId', adminMiddleware, adminController.deleteUser);
router.put('/admin/users/:userId/status', adminMiddleware, adminController.updateUserStatus);
router.get('/admin/rooms', adminMiddleware, adminController.getRooms);
router.get('/admin/rooms/:id', adminMiddleware, adminController.getRoom);
router.get('/admin/rooms/:id/members', adminMiddleware, adminController.getRoomMembers);
router.delete('/admin/rooms/:id', adminMiddleware, adminController.deleteRoom);

module.exports = router;