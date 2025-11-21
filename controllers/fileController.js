const RoomMember = require('../models/roomMember');
const fs = require('fs');
const path = require('path');
const { getFileType, getFileUrl } = require('../utils/fileUpload');

// 处理文件上传
exports.handleUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { roomId } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            // 删除已上传的文件
            const filePath = path.join(__dirname, '..', 'public', 'userdata', req.file.destination.split('/').pop(), req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 确定文件类型
        const mimeType = req.file.mimetype;
        const type = getFileType(mimeType);
        
        // 构建文件URL
        // req.file.destination 示例: public/userdata/picture
        const dirParts = req.file.destination.split(path.sep);
        const dirType = dirParts[dirParts.length - 1]; // 获取目录类型 (picture, video, flie等)
        const fileUrl = getFileUrl(req.file.filename, dirType === 'picture' ? 'image' : dirType === 'video' ? 'video' : 'file');
        
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

// 初始化分片上传
exports.initiateChunkedUpload = async (req, res) => {
    try {
        const { fileName, fileSize, roomId } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        // 创建临时文件夹来存储分片
        const tempDir = path.join(__dirname, '..', 'public', 'userdata', 'temp', `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // 计算总分片数 (每片25MB)
        const chunkSize = 25 * 1024 * 1024; // 25MB
        const totalChunks = Math.ceil(fileSize / chunkSize);
        
        res.json({
            success: true,
            uploadId: path.basename(tempDir),
            totalChunks,
            chunkSize
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 上传单个分片
exports.uploadChunk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { uploadId, chunkIndex } = req.body;
        
        // 移动分片文件到正确位置
        const tempDir = path.join(__dirname, '..', 'public', 'userdata', 'temp', uploadId);
        if (!fs.existsSync(tempDir)) {
            return res.status(400).json({ error: '无效的上传ID' });
        }
        
        const chunkFileName = `chunk-${chunkIndex}`;
        const finalPath = path.join(tempDir, chunkFileName);
        
        // 将文件从multer的临时位置移动到最终位置
        const tempPath = req.file.path;
        fs.renameSync(tempPath, finalPath);
        
        res.json({
            success: true,
            message: `分片 ${chunkIndex} 上传成功`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 完成分片上传并合并文件
exports.completeChunkedUpload = async (req, res) => {
    try {
        const { uploadId, fileName, fileType, roomId } = req.body;
        
        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.id, roomId }
        });
        
        if (!roomMember) {
            // 清理临时文件
            const tempDir = path.join(__dirname, '..', 'public', 'userdata', 'temp', uploadId);
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }
        
        const tempDir = path.join(__dirname, '..', 'public', 'userdata', 'temp', uploadId);
        if (!fs.existsSync(tempDir)) {
            return res.status(400).json({ error: '无效的上传ID' });
        }
        
        // 确定目标目录
        const targetDir = path.join(__dirname, '..', 'public', 'userdata', getFileTypeDirectory(fileType));
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(fileName);
        const finalFileName = `${fileType}-${uniqueSuffix}${ext}`;
        const finalFilePath = path.join(targetDir, finalFileName);
        
        // 合并所有分片
        const chunks = fs.readdirSync(tempDir)
            .filter(file => file.startsWith('chunk-'))
            .sort((a, b) => {
                const aIndex = parseInt(a.split('-')[1]);
                const bIndex = parseInt(b.split('-')[1]);
                return aIndex - bIndex;
            });
        
        // 创建写入流
        const writeStream = fs.createWriteStream(finalFilePath);
        
        // 依次写入所有分片
        for (const chunk of chunks) {
            const chunkPath = path.join(tempDir, chunk);
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }
        
        writeStream.end();
        
        // 等待写入完成
        writeStream.on('finish', () => {
            // 删除临时目录
            fs.rmSync(tempDir, { recursive: true });
            
            // 构建文件URL
            const fileUrl = getFileUrl(finalFileName, fileType);
            
            // 返回文件信息
            res.json({
                success: true,
                fileUrl,
                type: fileType,
                filename: fileName,
                size: fs.statSync(finalFilePath).size
            });
        });
        
        writeStream.on('error', (err) => {
            // 清理文件
            if (fs.existsSync(finalFilePath)) {
                fs.unlinkSync(finalFilePath);
            }
            // 清理临时目录
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            throw err;
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 根据文件类型获取目录名
function getFileTypeDirectory(fileType) {
    switch (fileType) {
        case 'image':
            return 'picture';
        case 'video':
            return 'video';
        default:
            return 'flie';
    }
}

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