const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 中间件
const authMiddleware = require('../middleware/authMiddleware').authMiddleware;
const { uploadSingle, uploadArray } = require('../utils/fileUpload');
const { messageRateLimiter } = require('../middleware/messageRateLimiter');
const { loginRateLimiter, registerRateLimiter } = require('../middleware/authRateLimiter');
const roomMemberMiddleware = require('../middleware/roomMemberMiddleware');
const roomAdminMiddleware = require('../middleware/roomAdminMiddleware');
const roomCreatorMiddleware = require('../middleware/roomCreatorMiddleware');

// 引入模型
const models = require('../models');
const { RoomMember, Message } = models;

// 认证相关路由
const authController = require('../controllers/authController');
// 用户登录接口
router.post('/auth/login', loginRateLimiter, authController.login);
// 用户注册接口
router.post('/auth/register', registerRateLimiter, authController.register);
// 检查用户名是否存在接口
router.post('/auth/check-username', authController.checkUsername);
// 用户登出接口
router.get('/auth/logout', authMiddleware, authController.logout);
// 验证令牌接口
router.get('/auth/verify', authController.verifyToken);

// 用户相关路由
const userController = require('../controllers/userController');
// 重置用户背景图片
router.get('/users/reset-background', authMiddleware, userController.resetBackground);
// 更新用户偏好设置
router.put('/users/preferences', authMiddleware, userController.updateUserPreferences);
// 更新用户资料
router.put('/users/profile', authMiddleware, userController.updateProfile);
// 修改用户密码
router.put('/users/password', authMiddleware, userController.changePassword);
// 获取用户偏好设置
router.get('/users/preferences', authMiddleware, userController.getUserPreferences);
// 根据用户ID获取用户资料
router.get('/users/profile/:userId', authMiddleware, userController.getUserById);

// 聊天室相关路由
const roomController = require('../controllers/roomController');
// 获取自己的聊天室列表
router.get('/rooms', authMiddleware, roomController.getRooms);
// 创建聊天室
router.post('/rooms', authMiddleware, roomController.createRoom);
// 创建私人聊天室
router.post('/rooms/private', authMiddleware, roomController.createPrivateRoom);

// 获取聊天室成员列表
router.get('/rooms/:roomId/members', authMiddleware, roomMemberMiddleware, roomController.getRoomMembers);
// 获取聊天室详情
router.get('/rooms/:roomId', authMiddleware, roomController.getRoom);
// 发送加入聊天室请求
router.get('/rooms/:roomId/join', authMiddleware, roomController.sendJoinRequest);
// 获取待处理的加入请求
router.get('/rooms/:roomId/pending-requests', authMiddleware, roomMemberMiddleware, roomController.getPendingRequests);
// 拉入聊天室
router.get('/rooms/:roomId/join/:userId', authMiddleware, roomAdminMiddleware, roomController.addMember);
// 拒绝用户加入聊天室的请求
router.delete('/rooms/:roomId/join-request/:userId', authMiddleware, roomAdminMiddleware, roomController.rejectJoinRequest);
// 更新聊天室设置
router.put('/rooms/:roomId/settings', authMiddleware, roomAdminMiddleware, roomController.updateRoomSettings);
// 设置聊天室成员角色
router.put('/rooms/:roomId/members/:userId/role', authMiddleware, roomCreatorMiddleware, roomController.setMemberRole);
// 踢出聊天室成员
router.delete('/rooms/:roomId/:userId', authMiddleware, roomAdminMiddleware, roomController.kickMember);
// 解散聊天室
router.delete('/rooms/:roomId', authMiddleware, roomCreatorMiddleware, roomController.deleteRoom);

// 消息相关路由
const messageController = require('../controllers/messageController');
// 获取聊天室消息历史记录 
router.get('/messages/:roomId/history', authMiddleware, roomMemberMiddleware, messageController.getMessageHistory);
// 获取聊天室消息
router.get('/messages/:roomId', authMiddleware, roomMemberMiddleware, messageController.getRoomMessages);
// 发送消息
router.post('/messages/:roomId/send', authMiddleware, messageRateLimiter, roomMemberMiddleware, messageController.sendMessage);
// 撤回消息
router.delete('/messages/:messageId', authMiddleware, messageController.recallMessage);

// 文件相关路由
const fileController = require('../controllers/fileController');
// 初始化分块上传
router.post('/upload/initiate', authMiddleware, fileController.initiateChunkedUpload);
// 上传文件块
router.post('/upload/chunk', authMiddleware, uploadSingle('chunk', 'chunk'), fileController.uploadChunk);
// 完成分块上传
router.post('/upload/complete', authMiddleware, fileController.completeChunkedUpload);
// 清理分块上传
router.post('/upload/cleanup', authMiddleware, fileController.cleanupChunkedUpload);
// 用户文件访问路由
const userDataController = require('../controllers/userdataController');
router.get('/userdata/:type/:filename', authMiddleware, userDataController.getUserdataFile);

// 搜索聊天室和用户 - 根据关键词搜索公开的聊天室和用户
router.get('/search', authMiddleware, roomController.search);

// 管理后台路由
const adminController = require('../controllers/adminController');
const adminMiddleware = require('../middleware/authMiddleware').adminMiddleware;
// 获取所有用户列表 - 管理员查看系统中所有用户的信息
router.get('/admin/users', authMiddleware, adminMiddleware, adminController.getUsers);
// 获取单个用户信息 - 管理员查看指定用户的信息
router.get('/admin/users/:userId', authMiddleware, adminMiddleware, adminController.getUserById);
// 创建用户 - 管理员手动创建新用户
router.post('/admin/users', authMiddleware, adminMiddleware, adminController.createUser);
// 更新用户信息 - 管理员修改指定用户的信息
router.put('/admin/users/:userId', authMiddleware, adminMiddleware, adminController.updateUser);
// 删除用户 - 管理员删除指定用户
router.delete('/admin/users/:userId', authMiddleware, adminMiddleware, adminController.deleteUser);
// 更新用户状态 - 管理员更改用户账户状态（如启用/禁用）
router.put('/admin/users/:userId/status', authMiddleware, adminMiddleware, adminController.updateUserStatus);
// 获取所有聊天室列表 - 管理员查看系统中所有聊天室的信息
router.get('/admin/rooms', authMiddleware, adminMiddleware, adminController.getRooms);
// 删除聊天室 - 管理员删除指定聊天室
router.delete('/admin/rooms/:id', authMiddleware, adminMiddleware, adminController.deleteRoom);
// 获取聊天室统计信息 - 管理员查看聊天室统计数据
router.get('/admin/rooms/statistics', authMiddleware, adminMiddleware, adminController.getRoomStatistics);

// 配置管理路由
const configController = require('../controllers/configController');
// 获取系统配置 - 管理员获取当前的系统设置
router.get('/admin/config', authMiddleware, adminMiddleware, configController.getConfig);
// 更新系统配置 - 管理员修改系统设置
router.put('/admin/config', authMiddleware, adminMiddleware, configController.updateConfig);

// 系统设置路由
const systemSettingController = require('../controllers/systemSettingController');
// 获取系统设置
router.get('/system/settings', systemSettingController.getSettings);
// 更新系统设置
router.put('/system/settings', authMiddleware, adminMiddleware, systemSettingController.updateSettings);
// 清除所有消息记录
router.post('/admin/messages/clear', authMiddleware, adminMiddleware, systemSettingController.clearAllMessages);
// 获取系统信息路由
const systemInfoController = require('../controllers/systemInfoController');
router.get('/system/info', authMiddleware, adminMiddleware, systemInfoController.getSystemInfo);

// 系统监控相关路由
const systemMonitorController = require('../controllers/systemMonitorController');
// 获取实时系统指标（CPU、内存、磁盘等）
router.get('/system/metrics', authMiddleware, adminMiddleware, systemMonitorController.getSystemMetrics);
// 获取历史系统指标数据
router.get('/system/metrics/history', authMiddleware, adminMiddleware, systemMonitorController.getSystemMetricsHistory);

module.exports = router;