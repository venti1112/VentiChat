// 导入依赖
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Sequelize } = require('sequelize'); // 只导入Sequelize类
const multer = require('multer');
const cookieParser = require('cookie-parser');
const config = require('./config/config.json');
const { log, logHttpError, logDatabaseQuery } = require('./utils/logger');

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 设置Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 将io实例挂载到app上，以便在路由中使用
app.set('io', io);

// 初始化Sequelize
const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: logDatabaseQuery, // 使用自定义日志函数记录数据库查询
    dialectOptions: {
        dateStrings: true,
        typeCast: true
    }
});

// 加载模型（每个模型接收 sequelize 实例，自行使用 sequelize.DataTypes）
const models = {
    User: require('./models/user')(sequelize),
    Room: require('./models/room')(sequelize),
    RoomMember: require('./models/roomMember')(sequelize),
    Message: require('./models/message')(sequelize),
    JoinRequest: require('./models/joinRequest')(sequelize)
};

// 手动设置模型关联，避免循环依赖
models.User.hasMany(models.Room, { foreignKey: 'creatorId', as: 'CreatedRooms' });
models.User.belongsToMany(models.Room, { through: models.RoomMember, as: 'JoinedRooms', foreignKey: 'user_id', otherKey: 'room_id' });
models.User.hasMany(models.RoomMember, { foreignKey: 'user_id', as: 'RoomMemberships' });

models.Room.belongsTo(models.User, { foreignKey: 'creatorId', as: 'Creator' });
models.Room.belongsToMany(models.User, { through: models.RoomMember, as: 'Participants', foreignKey: 'room_id', otherKey: 'user_id' });
models.Room.hasMany(models.RoomMember, { foreignKey: 'room_id', as: 'RoomMembers' });

models.RoomMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'User' });
models.RoomMember.belongsTo(models.Room, { foreignKey: 'room_id', as: 'Room' });

models.Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'Sender' });
models.Message.belongsTo(models.Room, { foreignKey: 'roomId', as: 'MessageRoom' });

models.JoinRequest.belongsTo(models.User, { foreignKey: 'userId' });
models.JoinRequest.belongsTo(models.Room, { foreignKey: 'roomId' });

// 中间件
app.use(express.json());
app.use(cookieParser()); // 添加 cookie-parser 中间件
app.use(express.static(path.join(__dirname, 'public')));

// 对于根路径，提供index.html文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加对常见页面的路由支持
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// 将upload实例挂载到app上
app.set('upload', upload);

// 用户Socket映射
const userSocketMap = new Map();

// 数据库连接状态
let isDatabaseConnected = false;

// 中间件：检查数据库连接状态
app.use((req, res, next) => {
    if (!isDatabaseConnected) {
        // 记录500错误访问日志
        const clientIP = req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
        const method = req.method;
        const url = req.url;
        
        logHttpError(clientIP, method, url, 500, '数据库连接失败');
        
        return res.status(500).json({ 
            error: '数据库连接失败，请稍后再试' 
        });
    }
    next();
});

// 路由
app.use('/api', require('./routes/index'));

// 404错误处理中间件
app.use((req, res, next) => {
    // 记录404错误访问日志
    const clientIP = req.ip || req.connection.remoteAddress || 
                    (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
    const method = req.method;
    const url = req.url;
    
    logHttpError(clientIP, '未登录', method, url, 404, '页面未找到');
    
    res.status(404).json({ 
        error: '页面未找到' 
    });
});

// 500错误处理中间件
app.use((err, req, res, next) => {
    // 记录500错误访问日志
    const clientIP = req.ip || req.connection.remoteAddress || 
                    (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
    const method = req.method;
    const url = req.url;
    
    logHttpError(clientIP, '未登录', method, url, 500, err.message || '内部服务器错误');
    
    res.status(500).json({ 
        error: '内部服务器错误' 
    });
});

// 数据库连接函数
async function connectToDatabase() {
    log('INFO', '正在连接数据库...');
    try {
        await sequelize.authenticate();
        log('INFO', '数据库连接成功');
        
        await sequelize.sync({ alter: true });
        log('INFO', '数据库同步完成');
        
        isDatabaseConnected = true;
        return true;
    } catch (err) {
        log('ERROR', '数据库连接失败：' + err.message);
        isDatabaseConnected = false;
        return false;
    }
}

// 数据库连接重试函数
async function retryDatabaseConnection() {
    const retryInterval = 3 * 60 * 1000; // 3分钟
    
    while (!isDatabaseConnected) {
        console.log('尝试重新连接数据库...');
        const connected = await connectToDatabase();
        
        if (!connected) {
            logDatabaseRetry();
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
}

// 错误处理
process.on('unhandledRejection', (err) => {
    console.error('未处理的Promise拒绝:', err);
    // 不直接退出进程，而是继续运行并尝试重新连接数据库
});

// 添加服务器正常退出日志
process.on('SIGINT', () => {
    log('INFO', '服务器正常退出');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('INFO', '服务器正常退出');
    process.exit(0);
});

// 启动服务器函数
async function startServer() {
    // 先尝试连接数据库
    const connected = await connectToDatabase();
    
    if (connected) {
        // 启动服务器
        server.listen(config.port, () => {
            log('INFO', `服务器成功启动，监听端口: ` + config.port);
        });
    } else {
        // 如果初始连接失败，启动重试机制
        console.log('数据库初始连接失败，启动重试机制...');
        retryDatabaseConnection();
        
        // 即使数据库未连接也启动服务器，但会返回500错误
        server.listen(config.port, () => {
            log('INFO', `服务器成功启动，监听端口: ` + config.port);
        });
    }
}

// 导出应用实例和模型
module.exports = { 
    app, 
    server, 
    sequelize, 
    models 
};

// Socket.IO 事件处理
io.on('connection', (socket) => {
    // 获取客户端IP地址
    const clientIP = socket.handshake.address || 
                   (socket.request.headers['x-forwarded-for'] || 
                    socket.request.connection.remoteAddress || 
                    'unknown');
    
    // 获取用户ID
    const userId = socket.handshake.query.userId || 'unknown';
    
    // 记录连接日志
    log('INFO', `用户连接Socket.IO - IP: ${clientIP}, 用户名: ${userId}, 结果: 成功`);
    
    // 获取用户ID并建立映射
    if (userId && userId !== 'unknown') {
        userSocketMap.set(userId, socket.id);
        
        // 断开连接时清除映射
        socket.on('disconnect', () => {
            userSocketMap.delete(userId);
            log('INFO', `用户断开Socket.IO - IP: ${clientIP}, 用户名: ${userId}, 结果: 成功`);
        });
    } else {
        socket.on('disconnect', () => {
            log('INFO', `用户断开Socket.IO - IP: ${clientIP}, 用户名: 未登录用户, 结果: 成功`);
        });
    }

    // 加入聊天室
    socket.on('joinRoom', (roomId) => {
        socket.join(`room_${roomId}`);
    });
    
    // 离开聊天室
    socket.on('leaveRoom', (roomId) => {
        socket.leave(`room_${roomId}`);
    });
});

// 启动应用
startServer();