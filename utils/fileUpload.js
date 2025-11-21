const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保userdata目录及子目录存在
const userdataDir = path.join(__dirname, '..', 'public', 'userdata');
const avatarDir = path.join(userdataDir, 'avatar');
const pictureDir = path.join(userdataDir, 'picture');
const videoDir = path.join(userdataDir, 'video');
const fileDir = path.join(userdataDir, 'flie'); // 注意：这里保持与现有目录名一致
const tempDir = path.join(userdataDir, 'temp'); // 临时目录用于分片上传

// 创建所有需要的目录
[userdataDir, avatarDir, pictureDir, videoDir, fileDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 根据文件类型确定存储目录
const getDestination = (fileType) => {
  switch (fileType) {
    case 'avatar':
      return avatarDir;
    case 'image':
      return pictureDir;
    case 'video':
      return videoDir;
    default:
      return fileDir;
  }
};

// 根据文件类型确定URL前缀
const getUrlPrefix = (fileType) => {
  switch (fileType) {
    case 'avatar':
      return '/userdata/avatar';
    case 'image':
      return '/userdata/picture';
    case 'video':
      return '/userdata/video';
    default:
      return '/userdata/flie';
  }
};

// 通用存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 从请求中获取文件类型，默认为'file'
    const fileType = req.fileType || 'file';
    const destDir = getDestination(fileType);
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // 为头像文件使用特殊命名规则
    if (req.fileType === 'avatar') {
      cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + ext);
    } else {
      cb(null, req.fileType + '-' + uniqueSuffix + ext);
    }
  }
});

// 分片上传存储配置
const chunkStorage = multer.diskStorage({
  destination: tempDir,
  filename: (req, file, cb) => {
    // 为分片文件生成临时名称
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'temp-' + uniqueSuffix);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    avatar: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'],
    video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mpeg'],
    file: [] // 所有文件类型都允许作为普通文件
  };

  // 获取请求中的文件类型
  const fileType = req.fileType || 'file';

  if (fileType === 'avatar' && allowedTypes.avatar.includes(file.mimetype)) {
    cb(null, true);
  } else if (fileType === 'image' && allowedTypes.image.includes(file.mimetype)) {
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
  avatar: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatar
    files: 1
  },
  image: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
    files: 1
  },
  video: {
    fileSize: 100 * 1024 * 1024, // 100MB for videos
    files: 1
  },
  file: {
    fileSize: 50 * 1024 * 1024, // 50MB for other files
    files: 1
  },
  chunk: {
    fileSize: 25 * 1024 * 1024, // 25MB for each chunk
    files: 1
  }
};

// 创建不同用途的multer实例
const createUpload = (type) => {
  if (type === 'chunk') {
    return multer({
      storage: chunkStorage,
      limits: limits.chunk
    });
  }
  
  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits[type] || limits.file
  });
};

// 导出单个文件上传中间件
const uploadSingle = (fieldName = 'file', type = 'file') => {
  return (req, res, next) => {
    req.fileType = type;
    return createUpload(type).single(fieldName)(req, res, next);
  };
};

// 导出多个文件上传中间件
const uploadMultiple = (fields = [{ name: 'files', maxCount: 10 }], type = 'file') => {
  return (req, res, next) => {
    req.fileType = type;
    return createUpload(type).fields(fields)(req, res, next);
  };
};

// 文件验证函数
const validateFile = (file, roomSettings) => {
  if (!file) {
    throw new Error('没有选择文件');
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
  
  return true;
};

// 根据MIME类型获取文件类型
const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else {
    return 'file';
  }
};

// 获取文件的URL路径
const getFileUrl = (filename, fileType) => {
  const prefix = getUrlPrefix(fileType);
  return `${prefix}/${filename}`;
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  validateFile,
  getFileType,
  getFileUrl
};