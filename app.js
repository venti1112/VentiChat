
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Sequelize } = require('sequelize');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cluster = require('cluster');
const config = require('./config/config.json');
const redisClient = require('./utils/redisClient');
const { log, logHttpError, logDatabaseQuery, logDatabaseRetry, logBrowserDevToolsWarning, LOG_LEVELS, logServerShutdown, processIds } = require('./utils/logger');

// 处理来自主进程的转发消息
if (cluster.isWorker) {
    process.on('message', (msg) => {
        if (msg.type === 'emitToSocket') {
            const io = app.get('io');
            const WebSocketManager = require('./utils/websocketManager');
            WebSocketManager.emitToSocket(msg.socketId, msg.event, msg.data, io);
        }
    });
}

// 创建Express应用
const app = express();

// 配置Express信任代理
app.set('trust proxy', true);

// 初始化Sequelize，配置连接池
const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: logDatabaseQuery, // 使用自定义日志函数记录数据库查询
    dialectOptions: {
        dateStrings: true,
        typeCast: true
    },
    pool: {
        max: 10,         // 最大连接数
        min: 0,          // 最小连接数
        acquire: 30000,  // 获取连接的最长等待时间（毫秒）
        idle: 10000      // 连接的最大空闲时间（毫秒）
    }
});

// 加载模型（每个模型接收 sequelize 实例，自行使用 sequelize.DataTypes）
const models = {
    User: require('./models/user')(sequelize),
    Room: require('./models/room')(sequelize),
    RoomMember: require('./models/roomMember')(sequelize),
    Message: require('./models/message')(sequelize),
    JoinRequest: require('./models/joinRequest')(sequelize),
    SystemSetting: require('./models/systemSetting')(sequelize),
};

// 调用各模型的associate方法设置关联关系
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// 将models对象挂载到app上，以便在其他地方使用
app.set('models', models);

// 中间件
app.use(express.json());
app.use(cookieParser()); // 添加 cookie-parser 中间件

// 添加Worker ID到响应头的中间件（放在最前面，确保所有请求都有这个header）
app.use((req, res, next) => {
    const { processIds } = require('./utils/logger');
    const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
    res.setHeader('X-Worker-Id', workerId);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/userdata', express.static(path.join(__dirname, 'public', 'userdata')));

// IP处理中间件 - 从反向代理获取真实IP
const realIpMiddleware = require('./middleware/realIpMiddleware');
app.use(realIpMiddleware);

// IP封禁中间件
const ipBanMiddleware = require('./middleware/ipBanMiddleware');
app.use(ipBanMiddleware);

// 对于根路径，提供index.html文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
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

// 使用Redis存储用户Socket映射，替代原来的本地Map
const userSocketMap = new Map();
// 将userSocketMap挂载到app上
app.set('userSocketMap', userSocketMap);

// 数据库连接状态
let isDatabaseConnected = false;

// 中间件：检查数据库连接状态
app.use(async (req, res, next) => {
    if (!isDatabaseConnected) {
        // 记录500错误访问日志
        const clientIP = req.realIP || req.ip || req.connection.remoteAddress || 
                        (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
        const method = req.method;
        const url = req.url;
        // 获取用户名
        let username = '未知用户';
        const token = req.cookies.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, config.encryptionKey);
                username = decoded.username || '未知用户';
            } catch (error) {
                // token无效，保持"未知用户"状态
            }
        }
        
        logHttpError(clientIP, username, method, url, 500, '数据库连接失败');
        
        return res.status(500).json({ 
            error: '数据库连接失败，请稍后再试' 
        });
    }
    next();
});

// 路由
app.use('/api', require('./routes/index'));


// 404错误处理中间件
app.use(async (req, res, next) => {
    // 记录404错误访问日志
    const clientIP = req.realIP || req.ip || req.connection.remoteAddress || 
                    (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
    const method = req.method;
    const url = req.url;
    
    // 获取用户名
    let username = '未认证用户';
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, config.encryptionKey);
            username = decoded.username || '未知用户';
        } catch (error) {
            // token无效，保持"未认证用户"状态
        }
    }
    
    // 特殊处理浏览器开发者工具的请求
    if (url === '/.well-known/appspecific/com.chrome.devtools.json') {
        logBrowserDevToolsWarning(clientIP, username);
    } else {
        logHttpError(clientIP, username, method, url, 404, '页面未找到');
    }
    
    res.status(404).json({ 
        error: '页面未找到' 
    });
});

// 500错误处理中间件
app.use(async (err, req, res, next) => {
    // 记录500错误访问日志
    const clientIP = req.realIP || req.ip || req.connection.remoteAddress || 
                    (req.headers['x-forwarded-for'] || '').split(',')[0] || '未知用户';
    const method = req.method;
    const url = req.url;
    
    // 获取用户名
    let username = '未认证用户';
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, config.encryptionKey);
            username = decoded.username || '未知用户';
        } catch (error) {
            // token无效，保持"未认证用户"状态
        }
    }
    
    logHttpError(clientIP, username, method, url, 500, `服务器内部错误: ${err.message}`);
    
    res.status(500).json({ 
        error: '服务器内部错误' 
    });
});

// 数据库连接函数
async function connectToDatabase() {
    try {
        await sequelize.authenticate();
        isDatabaseConnected = true;
        return true;
    } catch (err) {
        isDatabaseConnected = false;
        return false;
    }
}

// 数据库连接重试函数
async function retryDatabaseConnection() {
    const retryInterval = 3 * 60 * 1000; // 3分钟
    
    while (!isDatabaseConnected) {
        const connected = await connectToDatabase();
        
        if (!connected) {
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
}

// 错误处理
process.on('unhandledRejection', (err) => {
});

// 优雅关闭
process.on('SIGINT', () => {
    logServerShutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logServerShutdown();
    process.exit(0);
});

// 启动服务器函数
async function startServer(httpServer) {
    // 先尝试连接数据库
    const connected = await connectToDatabase();
    
    if (connected) {
        // 启动服务器
        httpServer.listen(config.port);
    } else {
        // 如果初始连接失败，启动重试机制
        retryDatabaseConnection();
        
        // 即使数据库未连接也启动服务器，但会返回500错误
        httpServer.listen(config.port);
    }

}

// 导出应用实例和模型
module.exports = { 
    app, 
    sequelize, 
    models,
    startServer
};

// 只有在直接运行此文件时才启动Socket.IO服务器
if (require.main === module) {
    // 创建HTTP服务器
    const server = http.createServer(app);
    
    // 设置Socket.IO
    const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://yourdomain.com' // 添加你的生产域名
    ];

    const io = socketIo(server, {
        cors: {
            origin: function (origin, callback) {
                // 允许没有origin的请求（如移动应用或curl）
                if (!origin) return callback(null, true);
                
                // 检查origin是否在允许列表中
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // 将io实例挂载到app上，以便在路由中使用
    app.set('io', io);
    
    // 启动服务器
    startServer(server);

    io.on('connection', async (socket) => {
        // 获取客户端IP地址
        const clientIP = socket.handshake.address || 
                       (socket.request.headers['x-forwarded-for'] || 
                        socket.request.connection.remoteAddress || 
                        '未知用户');
        
        // 从查询参数或auth中获取token
        const token = socket.handshake.query.token || socket.handshake.auth?.token;
        let userId = '未知用户';
        let username = '未知用户';
        
        // 验证token并获取用户信息
        if (token) {
            try {
                const decoded = jwt.verify(token, config.encryptionKey);
                const user = await models.User.findByPk(decoded.id || decoded.userId);
                if (user) {
                    userId = user.userId;
                    username = user.username;
                } else {
                    socket.emit('unauthorized', { message: '用户不存在' });
                    socket.disconnect(true);
                    return;
                }
            } catch (error) {
                socket.emit('unauthorized', { message: '令牌无效' });
                socket.disconnect(true);
                return;
            }
        } else {
            socket.emit('unauthorized', { message: '缺少访问令牌' });
            socket.disconnect(true);
            return;
        }
        
        // 获取用户ID并建立映射（使用Redis存储，支持跨进程）
        const WebSocketManager = require('./utils/websocketManager');
        const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        await WebSocketManager.storeUserSocket(userId, socket.id, workerId);
        
        // 断开连接时清除映射
        socket.on('disconnect', async () => {
            await WebSocketManager.removeUserSocket(userId, socket.id, workerId);
        });

        // 加入聊天室
        socket.on('joinRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.join(`room_${roomId}`);
            }
        });
        
        // 离开聊天室
        socket.on('leaveRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.leave(`room_${roomId}`);
            }
        });
    });
} else {
    // 当作为模块引入时，只创建HTTP服务器而不启动它
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
    
    // 导出服务器实例
    module.exports.server = server;
    
    // 在下一tick启动服务器，确保所有模块都已加载完毕
    process.nextTick(() => {
        startServer(server);
    });
    
    // 在工作进程启动后进行日志输出
    server.on('listening', () => {
        const cluster = require('cluster');
        const { processIds } = require('./utils/logger');
        const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        log(LOG_LEVELS.INFO, `工作进程 ${workerId} 启动完成`);
    });
    
    io.on('connection', async (socket) => {
        // 获取客户端IP地址
        const clientIP = socket.handshake.address || 
                       (socket.request.headers['x-forwarded-for'] || 
                        socket.request.connection.remoteAddress || 
                        '未知用户');
        
        // 从查询参数或auth中获取token
        const token = socket.handshake.query.token || socket.handshake.auth?.token;
        let userId = '未知用户';
        let username = '未知用户';
        
        // 验证token并获取用户信息
        if (token) {
            try {
                const decoded = jwt.verify(token, config.encryptionKey);
                const user = await models.User.findByPk(decoded.id || decoded.userId);
                if (user) {
                    userId = user.userId;
                    username = user.username;
                } else {
                    socket.emit('unauthorized', { message: '用户不存在' });
                    socket.disconnect(true);
                    return;
                }
            } catch (error) {
                socket.emit('unauthorized', { message: '令牌无效' });
                socket.disconnect(true);
                return;
            }
        } else {
            socket.emit('unauthorized', { message: '缺少访问令牌' });
            socket.disconnect(true);
            return;
        }
        
        // 获取用户ID并建立映射（使用Redis存储，支持跨进程）
        const WebSocketManager = require('./utils/websocketManager');
        const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        await WebSocketManager.storeUserSocket(userId, socket.id, workerId);
        
        // 断开连接时清除映射
        socket.on('disconnect', async () => {
            await WebSocketManager.removeUserSocket(userId, socket.id, workerId);
        });

        // 加入聊天室
        socket.on('joinRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.join(`room_${roomId}`);
            }
        });
        
        // 离开聊天室
        socket.on('leaveRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.leave(`room_${roomId}`);
            }
        });
    });
}