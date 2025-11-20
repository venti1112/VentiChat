const express = require('express');
const router = express.Router();

// 用户相关路由
const authController = require('../controllers/authController');
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/logout', authController.logout);

// 添加token验证路由
router.get('/auth/verify', authController.verifyToken);

// 修复：引入authMiddleware
const authMiddleware = require('../middleware/authMiddleware').authMiddleware;
const userController = require('../controllers/userController');
router.put('/users/profile', authMiddleware, userController.updateProfile);
router.get('/users/search', authMiddleware, userController.searchUsers);

// 聊天室相关路由
const roomController = require('../controllers/roomController');
router.get('/rooms', authMiddleware, roomController.getRooms);
router.post('/rooms', authMiddleware, roomController.createRoom);
router.post('/rooms/private', authMiddleware, roomController.createPrivateRoom);
router.get('/rooms/:roomId/members', authMiddleware, roomController.getRoomMembers);
router.delete('/rooms/:roomId/members/:userId', authMiddleware, roomController.kickUser);

// 消息相关路由
const messageController = require('../controllers/messageController');
const fileController = require('../controllers/fileController');
router.get('/messages/:roomId', authMiddleware, messageController.getRoomMessages);
router.post('/messages', authMiddleware, messageController.sendMessage);
router.put('/messages/:messageId/retract', authMiddleware, messageController.recallMessage);
router.post('/messages/file', authMiddleware, fileController.handleUpload);

// 管理后台路由
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/authMiddleware').adminMiddleware;
router.get('/admin/users', adminMiddleware, adminController.getUsers);
router.post('/admin/users', adminMiddleware, adminController.createUser);
router.put('/admin/users/:userId', adminMiddleware, adminController.updateUser);
router.delete('/admin/users/:userId', adminMiddleware, adminController.deleteUser);
router.put('/admin/users/:userId/status', adminMiddleware, adminController.toggleUserStatus);
router.get('/admin/rooms', adminMiddleware, adminController.getRooms);
router.delete('/admin/rooms/:roomId', adminMiddleware, adminController.deleteRoom);

module.exports = router;
