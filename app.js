// 导入依赖
const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config/config.json');
const { Sequelize } = require('sequelize'); // 移到顶部
const multer = require('multer');
const socketIo = require('socket.io');

// 创建应用和服务器
const app = express();
const server = http.createServer(app);

// 数据库连接
const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    timezone: '+08:00'
});

// 导入模型
const User = require('./models/user')(sequelize);
const Room = require('./models/room')(sequelize);
const RoomMember = require('./models/roomMember')(sequelize);
const Message = require('./models/message')(sequelize);
const JoinRequest = require('./models/joinRequest')(sequelize);

// 设置模型关联
User.associate({ Room, RoomMember, Message, JoinRequest });
Room.associate({ User, RoomMember, Message });
RoomMember.associate({ User, Room });
Message.associate({ User, Room });
JoinRequest.associate({ User, Room });

// 将模型挂载到app上
app.set('models', { User, Room, RoomMember, Message, JoinRequest });

// 启动定时清理任务
const startCleanupScheduler = require('./utils/cleanupScheduler');
startCleanupScheduler(app.get('models'), app);

// 同步数据库并启动服务器
sequelize.sync({ alter: true })
    .then(() => {
        console.log('数据库同步完成');
        
        server.listen(config.port, () => {
            console.log(`服务器运行在 ${config.baseUrl}:${config.port}`);
        });
    })
    .catch(err => {
        console.error('数据库同步失败:', err);
    });

// 中间件
app.use(express.json());

// 确保API路由在静态文件服务之前
app.use('/api', require('./routes/index'));

// 静态文件服务 - 放在所有路由之后
app.use(express.static(path.join(__dirname, 'public')));

// 添加HTML页面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// 设置Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket.IO 事件处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);
    
    // 获取用户ID并建立映射
    const userId = socket.handshake.query.userId;
    if (userId) {
        userSocketMap.set(userId, socket.id);
        console.log(`用户 ${userId} 建立Socket映射: ${socket.id}`);
        
        // 断开连接时清除映射
        socket.on('disconnect', () => {
            if (userId) {
                userSocketMap.delete(userId);
                console.log(`用户 ${userId} 清除Socket映射`);
            }
        });
    }
    
    // 加入聊天室
    socket.on('joinRoom', (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`用户 ${socket.id} 加入聊天室 ${roomId}`);
    });
    
    // 离开聊天室
    socket.on('leaveRoom', (roomId) => {
        socket.leave(`room_${roomId}`);
        console.log(`用户 ${socket.id} 离开聊天室 ${roomId}`);
    });
});

// 导出应用实例和模型
module.exports = { 
    app, 
    server, 
    sequelize, 
    models: { User, Room, RoomMember, Message, JoinRequest } 
};

// 错误处理
process.on('unhandledRejection', (err) => {
    console.error('未处理的Promise拒绝:', err);
    server.close(() => process.exit(1));
});
