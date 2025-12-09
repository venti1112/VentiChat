const fs = require('fs');
const path = require('path');
const models = require('../models');
const { RoomMember, Message } = models;

/**
 * userdata文件访问控制器
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 */
exports.getUserdataFile = (req, res) => {
  // 将异步函数包装在控制器方法内部，以确保Express能正确处理
  (async () => {
    try {
      const { type, filename } = req.params;
      const userId = req.user.userId; // 从认证中间件获取用户ID
      
      // 验证文件类型是否合法
      const validTypes = ['picture', 'video', 'audio', 'file', 'avatar', 'background'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: '无效的文件类型' });
      }
      
      // 构建文件路径
      const filePath = path.join(__dirname, '..', 'userdata', type, filename);
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
      }
      
      // 对于avatar和background文件，允许所有人访问
      if (type === 'avatar' || type === 'background') {
        return res.sendFile(filePath);
      }
      
      // 对于其他类型的文件，需要检查用户是否是该文件所属聊天室的成员
      // 通过文件URL在消息表中查找对应的聊天室ID
      const fileUrl = `/api/userdata/${type}/${filename}`;
      const message = await Message.findOne({
        where: { fileUrl: fileUrl },
        attributes: ['roomId']
      });
      
      if (!message) {
        return res.status(404).json({ error: '文件未关联到任何消息' });
      }
      
      const roomId = message.roomId;
      
      // 检查用户是否是该聊天室的成员
      const roomMember = await RoomMember.findOne({
        where: { 
          userId: userId,
          roomId: roomId
        }
      });
      
      if (!roomMember) {
        return res.status(403).json({ error: '您不是该文件所属聊天室的成员' });
      }
      
      // 用户通过验证，返回文件
      res.sendFile(filePath);
    } catch (error) {
      console.error('文件访问错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '内部服务器错误' });
      }
    }
  })();
};