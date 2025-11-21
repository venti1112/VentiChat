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

// 用户相关路由
const authController = require('../controllers/authController');
router.post('/auth/login', authController.login);
router.post('/auth/register', upload.single('avatar'), authController.register); // 添加文件上传中间件
router.get('/auth/logout', authController.logout);

// 添加token验证路由
router.get('/auth/verify', authController.verifyToken);

// 修复：引入authMiddleware
const authMiddleware = require('../middleware/authMiddleware').authMiddleware;
const userController = require('../controllers/userController');
router.put('/users/profile', authMiddleware, userController.updateProfile);
router.get('/users/search', authMiddleware, userController.searchUsers);
router.get('/users/:userId/avatar', authMiddleware, userController.getAvatarUrl); // 获取指定用户头像URL
router.get('/users/avatar', authMiddleware, userController.getAvatarUrl); // 获取当前用户头像URL

// 聊天室相关路由
const roomController = require('../controllers/roomController');
router.get('/rooms', authMiddleware, roomController.getRooms);
router.post('/rooms', authMiddleware, roomController.createRoom);
router.post('/rooms/private', authMiddleware, roomController.createPrivateRoom);
router.get('/rooms/:roomId/members', authMiddleware, roomController.getRoomMembers);
router.delete('/rooms/:roomId/members/:userId', authMiddleware, roomController.kickMember);
router.get('/rooms/search', authMiddleware, roomController.searchRooms);

// 消息相关路由
const messageController = require('../controllers/messageController');
const fileController = require('../controllers/fileController');

// 修改文件上传路由，使用新的上传机制
router.get('/messages/:roomId', authMiddleware, messageController.getRoomMessages);
router.post('/messages', authMiddleware, messageController.sendMessage);
router.put('/messages/:messageId/retract', authMiddleware, messageController.recallMessage);

// 为不同类型的文件上传提供专门的路由端点
router.post('/messages/image', authMiddleware, uploadSingle('file', 'image'), fileController.handleUpload);
router.post('/messages/video', authMiddleware, uploadSingle('file', 'video'), fileController.handleUpload);
router.post('/messages/file', authMiddleware, uploadSingle('file', 'file'), fileController.handleUpload);

// 分片上传路由
router.post('/messages/chunked/initiate', authMiddleware, fileController.initiateChunkedUpload);
router.post('/messages/chunked/upload', authMiddleware, uploadSingle('file', 'chunk'), fileController.uploadChunk);
router.post('/messages/chunked/complete', authMiddleware, fileController.completeChunkedUpload);

// 管理后台路由
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/authMiddleware').adminMiddleware;
router.get('/admin/users', adminMiddleware, adminController.getUsers);
router.post('/admin/users', adminMiddleware, adminController.createUser);
router.put('/admin/users/:userId', adminMiddleware, adminController.updateUser);
router.delete('/admin/users/:userId', adminMiddleware, adminController.deleteUser);
// 修复路由，使用新的控制器函数处理用户状态更新
router.put('/admin/users/:userId/status', adminMiddleware, adminController.updateUserStatus);
router.get('/admin/rooms', adminMiddleware, adminController.getRooms);
router.get('/admin/rooms/:id', adminMiddleware, adminController.getRoom);
router.get('/admin/rooms/:id/members', adminMiddleware, adminController.getRoomMembers);
router.delete('/admin/rooms/:id', adminMiddleware, adminController.deleteRoom);

module.exports = router;