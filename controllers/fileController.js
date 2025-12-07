const RoomMember = require('../models/roomMember');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { getFileType, getDestination } = require('../utils/fileUpload');

// 根据文件名获取MIME类型
function getMimeTypeFromFilename(filename) {
    // 使用mime-types库来获取MIME类型
    const mimeType = mime.lookup(filename);
    
    // 如果找不到MIME类型，则返回默认值
    return mimeType || 'application/octet-stream';
}


// 获取文件的URL路径（复制自utils/fileUpload.js）
function getFileUrl(filename, fileType) {
    // 根据文件类型确定URL前缀
    let prefix;
    switch (fileType) {
        case 'avatar':
            prefix = '/userdata/avatar';
            break;
        case 'image':
            prefix = '/userdata/picture';
            break;
        case 'video':
            prefix = '/userdata/video';
            break;
        case 'audio':
            prefix = '/userdata/audio';
            break;
        default:
            prefix = '/userdata/file';
    }
    
    return `${prefix}/${filename}`;
}

// 处理文件上传
exports.handleUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { roomId } = req.body;

        // 获取模型对象
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        
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
        
        // 生成新的文件名
        const fileExt = path.extname(req.file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFileName = fileType + '-' + uniqueSuffix + fileExt;
        
        // 确定目标目录并构建新路径
        const destinationDir = getDestination(fileType);
        const newPath = path.join(destinationDir, newFileName);
        
        // 重命名文件
        fs.renameSync(req.file.path, newPath);
        
        // 构建文件URL
        const fileUrl = getFileUrl(newFileName, fileType);
        
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

        // 获取模型对象
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        
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

        const { uploadId, chunkIndex, roomId } = req.body;
        
        // 检查roomId是否存在
        if (!roomId) {
            // 删除已上传的分片文件
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: '缺少roomId参数' });
        }

        // 验证用户在聊天室中
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.userId, roomId }
        });

        if (!roomMember) {
            // 删除已上传的分片文件
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }

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

        // 检查roomId是否存在
        if (!roomId) {
            return res.status(400).json({ error: '缺少roomId参数' });
        }

        // 验证用户在聊天室中
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
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

        // 确定文件类型和目标目录
        const fileExt = path.extname(fileName);
        const mimeType = getMimeTypeFromFilename(fileName);
        const fileType = getFileType(mimeType);
        const destinationDir = getDestination(fileType);
        
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFileName = fileType + '-' + uniqueSuffix + fileExt;
        const finalPath = path.join(destinationDir, newFileName);

        // 确保目标目录存在
        const targetDir = path.dirname(finalPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 组装分片目录路径
        const tempDir = path.join('public', 'temp', uploadId);
        
        // 检查临时目录是否存在
        if (!fs.existsSync(tempDir)) {
            return res.status(400).json({ error: '上传会话已过期或不存在' });
        }

        // 使用同步方式合并分片，确保顺序正确
        const writeStream = fs.createWriteStream(finalPath);
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(tempDir, `chunk-${i}`);
            
            // 检查分片是否存在
            if (!fs.existsSync(chunkPath)) {
                // 删除已经创建的文件和临时目录
                if (fs.existsSync(finalPath)) {
                    fs.unlinkSync(finalPath);
                }
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true });
                }
                return res.status(400).json({ error: `缺失分片 ${i}` });
            }
            
            // 读取分片内容并写入最终文件
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }
        
        // 关闭写入流并等待完成
        writeStream.end();
        
        // 等待写入完成
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', (err) => {
                // 发生错误时清理已创建的文件
                if (fs.existsSync(finalPath)) {
                    fs.unlinkSync(finalPath);
                }
                reject(err);
            });
        });

        // 验证文件是否正确创建
        if (!fs.existsSync(finalPath)) {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(500).json({ error: '文件合并失败' });
        }

        // 获取实际文件大小进行验证
        const stats = fs.statSync(finalPath);
        if (stats.size === 0) {
            // 删除空文件
            fs.unlinkSync(finalPath);
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(500).json({ error: '合并后的文件为空' });
        }

        // 清理临时目录（无论成功与否都要清理）
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
        } catch (cleanupError) {
            console.warn('清理临时文件时出错:', cleanupError);
            // 不中断主流程，只是记录警告
        }

        // 获取文件URL
        const fileUrl = getFileUrl(newFileName, fileType);

        res.json({
            fileUrl: fileUrl,
            fileName: fileName,
            fileSize: stats.size
        });
    } catch (error) {
        console.error('完成分片上传错误:', error);
        
        // 尝试清理可能残留的文件
        try {
            const { uploadId, fileName } = req.body;
            if (uploadId) {
                const tempDir = path.join('public', 'temp', uploadId);
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true });
                }
            }
        } catch (cleanupError) {
            console.warn('异常处理时清理临时文件失败:', cleanupError);
        }
        
        res.status(500).json({ error: '完成分片上传失败: ' + error.message });
    }
};

// 清理上传的文件块（当用户取消上传时调用）
exports.cleanupChunkedUpload = async (req, res) => {
    try {
        const { uploadId } = req.body;
        
        if (!uploadId) {
            return res.status(400).json({ error: '缺少uploadId参数' });
        }
        
        // 删除临时目录及其内容
        const tempDir = path.join('public', 'temp', uploadId);
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
        
        res.json({
            message: '上传文件块清理成功'
        });
    } catch (error) {
        console.error('清理上传文件块错误:', error);
        res.status(500).json({ error: '清理上传文件块失败' });
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
        const subDirs = ['avatar', 'picture', 'video', 'files'];
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