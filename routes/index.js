const express = require('express');
const router = express.Router();

// 用户相关路由
const authController = require('../controllers/authController');
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.post('/auth/logout', authController.logout);
// 修复：引入authMiddleware
const authMiddleware = require('../middleware/authMiddleware').authMiddleware;
const userController = require('../controllers/userController');
router.put('/users/profile', authMiddleware, userController.updateProfile);
router.get('/users/search', authMiddleware, userController.searchUsers);

// 聊天室相关路由
const roomController = require('../controllers/roomController');
router.get('/rooms', roomController.getUserRooms);
router.post('/rooms', roomController.createRoom);
router.post('/rooms/private', roomController.createPrivateRoom);
router.get('/rooms/:roomId/members', roomController.getRoomMembers);
router.delete('/rooms/:roomId/members/:userId', roomController.kickUser);

// 消息相关路由
const messageController = require('../controllers/messageController');
const fileController = require('../controllers/fileController');
router.get('/messages/:roomId', messageController.getRoomMessages);
router.post('/messages', messageController.sendMessage);
router.put('/messages/:messageId/retract', messageController.recallMessage);
router.post('/messages/file', fileController.handleUpload);

// 管理后台路由
const adminController = require('../controllers/adminController');
router.get('/admin/users', adminController.getUsers);
router.post('/admin/users', adminController.createUser);
router.put('/admin/users/:userId', adminController.updateUser);
router.delete('/admin/users/:userId', adminController.deleteUser);
router.put('/admin/users/:userId/status', adminController.toggleUserStatus);
router.get('/admin/rooms', adminController.getRooms);
router.delete('/admin/rooms/:roomId', adminController.deleteRoom);

module.exports = router;
