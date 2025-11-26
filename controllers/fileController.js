const RoomMember = require('../models/roomMember');
const fs = require('fs');
const path = require('path');
const { getFileType, getFileUrl } = require('../utils/fileUpload');

// 处理文件上传
exports.handleUpload = async (req, res) => {
    try {
        // 获取模型对象
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { roomId } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.userId, roomId }
        });
        
        if (!roomMember) {
            // 删除已上传的文件
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 获取文件类型
        const fileType = getFileType(req.file.mimetype);
        
        // 构建文件URL（修复参数传递）
        const fileUrl = getFileUrl(req.file.filename, fileType);
        
        // 返回文件信息
        res.json({
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    } catch (error) {
        console.error('文件上传错误:', error);
        res.status(500).json({ error: '文件上传失败' });
    }
};

// 初始化分片上传
exports.initiateChunkedUpload = async (req, res) => {
    try {
        const { fileName, fileSize, roomId } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.userId, roomId }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 生成唯一上传ID
        const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建临时目录
        const tempDir = path.join('public', 'temp', uploadId);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        res.json({
            uploadId: uploadId,
            message: '分片上传初始化成功'
        });
    } catch (error) {
        console.error('初始化分片上传错误:', error);
        res.status(500).json({ error: '初始化分片上传失败' });
    }
};

// 上传分片
exports.uploadChunk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { uploadId, chunkIndex } = req.body;
        
        // 移动分片到临时目录
        const tempDir = path.join('public', 'temp', uploadId);
        if (!fs.existsSync(tempDir)) {
            return res.status(400).json({ error: '无效的上传ID' });
        }
        
        const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
        fs.renameSync(req.file.path, chunkPath);
        
        res.json({
            message: `分片 ${chunkIndex} 上传成功`
        });
    } catch (error) {
        console.error('上传分片错误:', error);
        res.status(500).json({ error: '上传分片失败' });
    }
};

// 完成分片上传
exports.completeChunkedUpload = async (req, res) => {
    try {
        const { uploadId, fileName, fileSize, roomId, totalChunks } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.userId, roomId }
        });
        
        if (!roomMember) {
            // 清理临时文件
            const tempDir = path.join('public', 'temp', uploadId);
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 组装分片
        const tempDir = path.join('public', 'temp', uploadId);
        const finalPath = path.join('public', 'userdata', 'files', fileName);
        
        // 确保目标目录存在
        const targetDir = path.dirname(finalPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 创建写入流
        const writeStream = fs.createWriteStream(finalPath);
        
        // 按顺序合并分片
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(tempDir, `chunk-${i}`);
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
            fs.unlinkSync(chunkPath); // 删除已合并的分片
        }
        
        writeStream.end();
        
        // 清理临时目录
        fs.rmdirSync(tempDir);
        
        // 获取文件类型和URL
        const fileType = path.extname(fileName).toLowerCase().substring(1);
        const fileUrl = `/userdata/files/${fileName}`;
        
        res.json({
            fileUrl: fileUrl,
            fileName: fileName,
            fileSize: fs.statSync(finalPath).size
        });
    } catch (error) {
        console.error('完成分片上传错误:', error);
        res.status(500).json({ error: '完成分片上传失败' });
    }
};

// 文件下载（可选）
exports.downloadFile = async (req, res) => {
    try {
        const { filename } = req.params;
        // 这里需要更复杂的逻辑来确定文件在哪个子目录中
        const baseDir = path.join(__dirname, '..', 'public', 'userdata');
        let filePath = '';
        let found = false;
        
        // 在所有可能的子目录中查找文件
        const subDirs = ['avatar', 'picture', 'video', 'flie'];
        for (const subDir of subDirs) {
            const possiblePath = path.join(baseDir, subDir, filename);
            if (fs.existsSync(possiblePath)) {
                filePath = possiblePath;
                found = true;
                break;
            }
        }
        
        if (found) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: '文件不存在' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};