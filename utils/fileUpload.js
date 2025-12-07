const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

// 确保userdata目录及子目录存在
const userdataDir = path.join(__dirname, '..', 'userdata');
const avatarDir = path.join(userdataDir, 'avatar');
const backgroundDir = path.join(userdataDir, 'background');
const pictureDir = path.join(userdataDir, 'picture');
const videoDir = path.join(userdataDir, 'video');
const audioDir = path.join(userdataDir, 'audio');
const fileDir = path.join(userdataDir, 'file');
const tempDir = path.join(userdataDir, 'temp');

// 创建所有需要的目录
[userdataDir, avatarDir, backgroundDir, pictureDir, videoDir, audioDir, fileDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 根据文件类型确定存储目录
const getDestination = (fileType, purpose) => {
  // 根据purpose确定特定目录
  if (purpose === 'avatar') {
    return avatarDir;
  } else if (purpose === 'background') {
    return backgroundDir;
  }
  
  // 根据文件类型确定存储目录
  switch (fileType) {
    case 'image':
      return pictureDir;
    case 'video':
      return videoDir;
    case 'audio':
      return audioDir;
    default:
      return fileDir;
  }
};

// 根据文件类型确定URL前缀
const getUrlPrefix = (fileType, purpose) => {
  // 根据purpose确定特定URL前缀
  if (purpose === 'avatar') {
    return '/api/userdata/avatar';
  } else if (purpose === 'background') {
    return '/api/userdata/background';
  }
  
  // 根据文件类型确定URL前缀
  switch (fileType) {
    case 'image':
      return '/api/userdata/picture';
    case 'video':
      return '/api/userdata/video';
    case 'audio':
      return '/api/userdata/audio';
    default:
      return '/api/userdata/file';
  }
};

// 通用存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 从请求中获取文件类型和目的，默认为'file'和'message'
    const fileType = req.fileType || 'file';
    const purpose = req.body.purpose || 'message';
    const destDir = getDestination(fileType, purpose);
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    // 根据purpose使用特殊命名规则
    const purpose = req.body.purpose || 'message';
    if (purpose === 'avatar') {
      cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + ext);
    } else if (purpose === 'background') {
      cb(null, 'background-' + req.user.id + '-' + uniqueSuffix + ext);
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
  audio: {
    fileSize: 50 * 1024 * 1024, // 50MB for audio files
    files: 1
  },
  file: {
    fileSize: 50 * 1024 * 1024, // 50MB for other files
    files: 1
  },
  chunk: {
    fileSize: 30 * 1024 * 1024, // 30MB for each chunk (稍微大于前端设置的25MB以提供缓冲空间)
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

// 导出多个文件上传中间件（按字段名）
const uploadArray = (fieldName = 'files', type = 'file', maxCount = 10) => {
  return (req, res, next) => {
    req.fileType = type;
    return createUpload(type).array(fieldName, maxCount)(req, res, next);
  };
};

// 添加getFileType函数定义
function getFileType(mimeType) {
  // 简化文件类型判断逻辑，只根据MIME类型前缀判断
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'file';
  }
}

module.exports = {
  uploadSingle,
  uploadArray,
  getDestination,
  getUrlPrefix,
  getFileType
};