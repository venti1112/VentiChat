const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 创建上传目录
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    const allowedTypes = {
        image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'],
        file: [] // 所有文件类型都允许作为普通文件
    };
    
    // 获取请求中的文件类型（通过自定义字段）
    const fileType = req.body.fileType || req.query.fileType || 'file';
    
    if (fileType === 'image' && allowedTypes.image.includes(file.mimetype)) {
        cb(null, true);
    } else if (fileType === 'video' && allowedTypes.video.includes(file.mimetype)) {
        cb(null, true);
    } else if (fileType === 'file') {
        cb(null, true); // 所有文件都允许作为普通文件
    } else {
        cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
};

// 限制配置
const limits = {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
};

// 创建multer实例
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
});

// 导出单个文件上传中间件
const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

// 导出多个文件上传中间件
const uploadMultiple = (fields = [{ name: 'files', maxCount: 10 }]) => upload.fields(fields);

// 文件验证函数
const validateFile = (file, roomSettings) => {
    if (!file) {
        throw new Error('没有选择文件');
    }
    
    // 检查文件大小
    if (file.size > limits.fileSize) {
        throw new Error(`文件大小超过限制 (${limits.fileSize / (1024*1024)}MB)`);
    }
    
    // 根据文件类型检查聊天室设置
    const fileType = getFileType(file.mimetype);
    
    switch (fileType) {
        case 'image':
            if (!roomSettings.allowImages) {
                throw new Error('该聊天室不允许发送图片');
            }
            break;
        case 'video':
            if (!roomSettings.allowVideos) {
                throw new Error('该聊天室不允许发送视频');
            }
            break;
        case 'file':
            if (!roomSettings.allowFiles) {
                throw new Error('该聊天室不允许发送文件');
            }
            break;
    }
    
    return fileType;
};

// 获取文件类型
const getFileType = (mimeType) => {
    if (mimeType.startsWith('image/')) {
        return 'image';
    } else if (mimeType.startsWith('video/')) {
        return 'video';
    } else {
        return 'file';
    }
};

// 获取文件URL
const getFileUrl = (filename) => {
    const config = require('../config/config.json');
    return `${config.baseUrl}/uploads/${filename}`;
};

// 删除过期文件
const deleteFile = (filename) => {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

module.exports = {
    uploadSingle,
    uploadMultiple,
    validateFile,
    getFileType,
    getFileUrl,
    deleteFile
};