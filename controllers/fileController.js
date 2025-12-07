const RoomMember = require('../models/roomMember');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { getFileType, getDestination, getUrlPrefix } = require('../utils/fileUpload');

// 根据文件名获取MIME类型
function getMimeTypeFromFilename(filename) {
    // 使用mime-types库来获取MIME类型
    const mimeType = mime.lookup(filename);
    
    // 如果找不到MIME类型，则返回默认值
    return mimeType || 'application/octet-stream';
}

// 获取文件的URL路径
function getFileUrl(filename, fileType, purpose = 'message') {
    // 根据文件类型和purpose确定URL前缀
    let prefix = getUrlPrefix(fileType, purpose);
    return `${prefix}/${filename}`;
}

// 初始化分片上传
exports.initiateChunkedUpload = async (req, res) => {
    try {
        const { fileName, fileSize, roomId } = req.body;
        const purpose = req.body.purpose || 'message'; // 获取purpose字段，默认为message

        // 获取模型对象
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        const User = models.User;
        
        // 如果是头像或背景图片上传，直接处理，不需要检查聊天室成员身份
        if (purpose === 'avatar' || purpose === 'background') {
            // 生成唯一上传ID
            const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 创建临时目录
            const tempDir = path.join('userdata', 'temp', uploadId);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            return res.json({
                uploadId: uploadId,
                message: '分片上传初始化成功'
            });
        }

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
        const tempDir = path.join('userdata', 'temp', uploadId);
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
        const purpose = req.body.purpose || 'message'; // 获取purpose字段，默认为message
        
        // 移动分片到临时目录
        const tempDir = path.join('userdata', 'temp', uploadId);
        if (!fs.existsSync(tempDir)) {
            // 删除已上传的分片文件
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: '无效的上传ID' });
        }

        const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
        
        // 检查原始文件是否存在并且有内容
        if (!fs.existsSync(req.file.path)) {
            return res.status(400).json({ error: '上传的分片文件不存在' });
        }
        
        const stats = fs.statSync(req.file.path);
        if (stats.size === 0) {
            // 删除空的分片文件
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: '上传的分片文件为空' });
        }
        
        fs.renameSync(req.file.path, chunkPath);

        res.json({
            message: `分片 ${chunkIndex} 上传成功`,
            size: stats.size
        });
    } catch (error) {
        console.error('上传分片错误:', error);
        // 尝试删除可能存在的临时文件
        try {
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (e) {
            console.warn('清理上传分片时出错:', e);
        }
        res.status(500).json({ error: '上传分片失败' });
    }
};

// 完成分片上传
exports.completeChunkedUpload = async (req, res) => {
    try {
        const { uploadId, fileName, fileSize, roomId, totalChunks } = req.body;
        const purpose = req.body.purpose || 'message'; // 获取purpose字段，默认为message

        // 获取模型对象
        const models = req.app.get('models');
        const RoomMember = models.RoomMember;
        const User = models.User;
        
        // 如果是头像或背景图片上传，直接处理，不需要检查聊天室成员身份
        if (purpose === 'avatar' || purpose === 'background') {
            // 确定文件类型和目标目录
            const fileExt = path.extname(fileName);
            const mimeType = getMimeTypeFromFilename(fileName);
            const fileType = getFileType(mimeType);
            const destinationDir = getDestination(fileType, purpose);
            
            // 生成唯一文件名
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            let newFileName;
            if (purpose === 'avatar') {
                newFileName = 'avatar-' + req.user.userId + '-' + uniqueSuffix + fileExt;
            } else if (purpose === 'background') {
                newFileName = 'background-' + req.user.userId + '-' + uniqueSuffix + fileExt;
            }
            
            const finalPath = path.join(destinationDir, newFileName);

            // 确保目标目录存在
            const targetDir = path.dirname(finalPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // 组装分片目录路径
            const tempDir = path.join('userdata', 'temp', uploadId);
            
            // 检查临时目录是否存在
            if (!fs.existsSync(tempDir)) {
                return res.status(400).json({ error: '上传会话已过期或不存在' });
            }

            // 使用更可靠的方法合并文件分片
            // 先收集所有分片的数据
            const chunksData = [];
            let totalSize = 0;
            let hasValidChunk = false;
            
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
                
                // 读取分片内容
                const chunkData = fs.readFileSync(chunkPath);
                chunksData.push(chunkData);
                totalSize += chunkData.length;
                
                // 检查是否有非空分片
                if (chunkData.length > 0) {
                    hasValidChunk = true;
                }
            }
            
            // 验证是否有有效的分片
            if (!hasValidChunk) {
                // 清理并返回错误
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true });
                }
                return res.status(400).json({ error: '所有分片均为空，无法合并' });
            }

            // 一次性写入所有数据到文件
            const buffer = Buffer.concat(chunksData);
            fs.writeFileSync(finalPath, buffer);

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
            const fileUrl = getFileUrl(newFileName, fileType, purpose);
            
            // 更新用户信息
            if (purpose === 'avatar') {
                await User.update(
                    { avatarUrl: fileUrl },
                    { where: { userId: req.user.userId } }
                );
            } else if (purpose === 'background') {
                await User.update(
                    { backgroundUrl: fileUrl },
                    { where: { userId: req.user.userId } }
                );
            }

            return res.json({
                fileUrl: fileUrl,
                fileName: fileName,
                fileSize: stats.size
            });
        }

        // 验证用户在聊天室中
        const roomMember = await RoomMember.findOne({
            where: { userId: req.user.userId, roomId }
        });

        if (!roomMember) {
            // 清理临时文件
            const tempDir = path.join('userdata', 'temp', uploadId);
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(403).json({ error: '您不是该聊天室的成员' });
        }

        // 确定文件类型和目标目录
        const fileExt = path.extname(fileName);
        const mimeType = getMimeTypeFromFilename(fileName);
        const fileType = getFileType(mimeType);
        const destinationDir = getDestination(fileType, purpose);
        
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
        const tempDir = path.join('userdata', 'temp', uploadId);
        
        // 检查临时目录是否存在
        if (!fs.existsSync(tempDir)) {
            return res.status(400).json({ error: '上传会话已过期或不存在' });
        }

        // 使用更可靠的方法合并文件分片
        // 先收集所有分片的数据
        const chunksData = [];
        let totalSize = 0;
        let hasValidChunk = false;
        
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
            
            // 读取分片内容
            const chunkData = fs.readFileSync(chunkPath);
            chunksData.push(chunkData);
            totalSize += chunkData.length;
            
            // 检查是否有非空分片
            if (chunkData.length > 0) {
                hasValidChunk = true;
            }
        }
        
        // 验证是否有有效的分片
        if (!hasValidChunk) {
            // 清理并返回错误
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
            return res.status(400).json({ error: '所有分片均为空，无法合并' });
        }

        // 一次性写入所有数据到文件
        const buffer = Buffer.concat(chunksData);
        fs.writeFileSync(finalPath, buffer);

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
        const fileUrl = getFileUrl(newFileName, fileType, purpose);

        res.json({
            fileUrl: fileUrl,
            fileName: fileName,
            fileSize: stats.size
        });
    } catch (error) {
        console.error('完成分片上传错误:', error);
        
        // 尝试清理可能残留的文件
        try {
            const { uploadId } = req.body;
            if (uploadId) {
                const tempDir = path.join('userdata', 'temp', uploadId);
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

// 清理分片上传
exports.cleanupChunkedUpload = async (req, res) => {
    try {
        const { uploadId } = req.body;
        const tempDir = path.join('userdata', 'temp', uploadId);
        
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
            return res.json({ message: '临时文件清理成功' });
        }
        
        res.status(400).json({ error: '无效的上传ID' });
    } catch (error) {
        console.error('清理分片上传错误:', error);
        res.status(500).json({ error: '清理临时文件失败' });
    }
};

// 文件下载（可选）
exports.downloadFile = async (req, res) => {
    try {
        const { filename } = req.params;
        // 这里需要更复杂的逻辑来确定文件在哪个子目录中
        const baseDir = path.join(__dirname, '..', 'userdata');
        let filePath = '';
        let found = false;
        
        // 在所有可能的子目录中查找文件
        const subDirs = ['avatar', 'background', 'picture', 'video', 'files'];
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