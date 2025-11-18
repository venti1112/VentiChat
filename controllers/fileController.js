const { models } = require('../app');
const fs = require('fs');
const path = require('path');

// 处理文件上传
exports.handleUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { roomId } = req.body;
        const fileUrl = `/uploads/${req.file.filename}`;
        
        // 验证用户在聊天室中
        const roomMember = await models.RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            // 删除已上传的文件
            fs.unlinkSync(path.join(__dirname, '..', 'public', fileUrl));
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 确定文件类型
        const mimeType = req.file.mimetype;
        let type = 'file';
        if (mimeType.startsWith('image/')) {
            type = 'image';
        } else if (mimeType.startsWith('video/')) {
            type = 'video';
        }
        
        // 返回文件信息，由前端决定是否发送消息
        res.json({
            success: true,
            fileUrl,
            type,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 文件下载（可选）
exports.downloadFile = async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '..', 'public', 'uploads', filename);
        
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: '文件不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};