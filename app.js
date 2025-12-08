// 导入依赖
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Sequelize } = require('sequelize'); // 只导入Sequelize类
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cluster = require('cluster');
const config = require('./config/config.json');
const redisClient = require('./utils/redisClient');
const { log, logHttpError, logDatabaseQuery, logDatabaseRetry, logBrowserDevToolsWarning, LOG_LEVELS, processIds } = require('./utils/logger');

// 处理来自主进程的转发消息
if (cluster.isWorker) {
    process.on('message', (msg) => {
        log(LOG_LEVELS.DEBUG, `工作进程收到主进程消息: ${JSON.stringify(msg)}`);
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
    port: parseInt(config.db.port), // 确保端口是数字类型
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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// 路由
app.use('/api', require('./routes/index'));

// 404 处理中间件 - 记录未匹配的路由请求
app.use((req, res, next) => {
    const clientIP = req.ip || 
                   (req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    '未知IP');
    
    log(LOG_LEVELS.WARN, `404 Not Found - IP: ${clientIP} - Method: ${req.method} - URL: ${req.originalUrl}`);
    
    // 如果是API请求，返回JSON格式错误
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ 
            error: 'API endpoint not found',
            code: 404,
            message: '请求的接口不存在'
        });
    }
    
    // 对于其他请求，尝试发送首页或返回简单HTML
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.status(404).send('<h1>404 页面未找到</h1><p>您请求的页面不存在。</p>');
});

    // 创建HTTP服务器
    const server = http.createServer(app);
    
    // 设置Socket.IO
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        // 添加连接配置以提高稳定性
        pingTimeout: 60000, // 增加ping超时时间到60秒
        pingInterval: 25000, // 设置ping间隔为25秒
        upgradeTimeout: 30000, // 升级超时时间30秒
        allowEIO3: true, // 允许Engine.IO v3客户端连接
        transports: ["websocket", "polling"] // 允许websocket和轮询传输
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
        const port = process.env.WORKER_PORT || config.port;
        log(LOG_LEVELS.INFO, `工作进程 ${workerId} 启动完成，监听端口 ${parseInt(port) + 1}`);
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
                    log(LOG_LEVELS.WARN, `用户不存在 [用户ID: ${decoded.id || decoded.userId}]`);
                    socket.emit('unauthorized', { message: '用户不存在' });
                    socket.disconnect(true);
                    return;
                }
            } catch (error) {
                log(LOG_LEVELS.WARN, `令牌验证失败: ${error.message}`);
                socket.emit('unauthorized', { message: '令牌无效' });
                socket.disconnect(true);
                return;
            }
        } else {
            log(LOG_LEVELS.WARN, '缺少访问令牌');
            socket.emit('unauthorized', { message: '缺少访问令牌' });
            socket.disconnect(true);
            return;
        }
        
        // 获取用户ID并建立映射（使用Redis存储，支持跨进程）
        const WebSocketManager = require('./utils/websocketManager');
        const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        await WebSocketManager.storeUserSocket(userId, socket.id, workerId);
        
        // 输出WebSocket连接建立日志
        log(LOG_LEVELS.INFO, `WebSocket连接已建立 [用户: ${username}(${userId})] [Socket ID: ${socket.id}]`);
        
        // 发送连接成功的事件给客户端
        socket.emit('connected', { message: '连接成功', userId: userId });
        
        // 断开连接时清除映射
        socket.on('disconnect', async (reason) => {
            await WebSocketManager.removeUserSocket(userId, socket.id, workerId);
            // 输出WebSocket连接断开日志
            log(LOG_LEVELS.INFO, `WebSocket连接已断开 [用户: ${username}(${userId})] [Socket ID: ${socket.id}] [原因: ${reason}]`);
        });

        // 加入聊天室
        socket.on('joinRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.join(`room_${roomId}`);
                socket.emit('joinedRoom', { roomId: roomId }); // 确认加入房间
                // 输出加入聊天室日志
                log(LOG_LEVELS.INFO, `用户加入聊天室 [用户: ${username}(${userId})] [房间ID: ${roomId}]`);
            }
        });
        
        // 离开聊天室
        socket.on('leaveRoom', (data) => {
            // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
            const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
            if (roomId) {
                socket.leave(`room_${roomId}`);
                socket.emit('leftRoom', { roomId: roomId }); // 确认离开房间
                // 输出离开聊天室日志
                log(LOG_LEVELS.INFO, `用户离开聊天室 [用户: ${username}(${userId})] [房间ID: ${roomId}]`);
            }
        });
        
        // 处理错误
        socket.on('error', (error) => {
            log(LOG_LEVELS.ERROR, `Socket错误 [用户: ${username}(${userId})]: ${error.message}`);
        });
        
        // 处理发送消息事件
        socket.on('sendMessage', async (data) => {
            try {
                log(LOG_LEVELS.DEBUG, `收到发送消息请求 [用户: ${username}(${userId})] [数据: ${JSON.stringify(data)}]`);
                
                const { rid, content, type } = data;
                
                // 检查必要参数
                if (!rid || !content) {
                    log(LOG_LEVELS.WARN, `缺少必要参数 [用户: ${username}(${userId})] [rid: ${rid}, content: ${content}]`);
                    socket.emit('errorMessage', { message: '缺少必要参数' });
                    return;
                }
                
                // 验证用户是否是聊天室成员（使用正确导入的模型）
                const roomMember = await models.RoomMember.findOne({
                    where: {
                        userId: userId,
                        roomId: rid
                    }
                });
                
                if (!roomMember) {
                    log(LOG_LEVELS.WARN, `用户不是聊天室成员 [用户: ${username}(${userId})] [房间ID: ${rid}]`);
                    socket.emit('errorMessage', { message: '您不是该聊天室的成员' });
                    return;
                }
                
                // 创建消息
                const message = await models.Message.create({
                    userId: userId,
                    roomId: rid,
                    content: content,
                    type: type || 'text'
                });
                
                log(LOG_LEVELS.DEBUG, `消息创建成功 [消息ID: ${message.messageId}] [用户: ${username}(${userId})] [房间ID: ${rid}]`);
                
                // 获取发送者信息
                const sender = await models.User.findByPk(userId, {
                    attributes: ['userId', 'username', 'nickname', 'avatarUrl']
                });
                
                // 组装完整消息对象
                const messageData = {
                    ...message.toJSON(),
                    Sender: sender
                };
                
                // 广播消息到房间（使用WebSocketManager实现跨进程广播）
                const io = app.get('io');
                const WebSocketManager = require('./utils/websocketManager');
                
                // 获取房间内的所有用户
                const roomMembers = await models.RoomMember.findAll({
                    where: {
                        roomId: rid
                    },
                    attributes: ['userId']
                });
                
                // 向房间内除发送者外的所有用户广播消息
                for (const member of roomMembers) {
                    if (member.userId !== userId) {
                        await WebSocketManager.sendToUser(member.userId, 'newMessage', messageData, io);
                    }
                }
                
                log(LOG_LEVELS.INFO, `消息已广播到房间 [消息ID: ${message.messageId}] [用户: ${username}(${userId})] [房间ID: ${rid}]`);
                
                // 向发送者确认消息已发送
                socket.emit('messageSent', { 
                    messageId: message.messageId,
                    ...messageData
                });
                
                log(LOG_LEVELS.INFO, `用户发送消息 [工作进程: ${workerId}] [用户: ${username}(${userId})] [房间ID: ${rid}] [消息ID: ${message.messageId}]`);
            } catch (error) {
                log(LOG_LEVELS.ERROR, `发送消息失败: ${error.message}`);
                socket.emit('errorMessage', { message: '发送消息失败: ' + error.message });
            }
        });
    });

// 数据库连接和重试逻辑
let connectionRetryCount = 0;
const maxRetries = 5;
const retryDelay = 5000; // 5秒

async function connectToDatabase() {
    try {
        await sequelize.authenticate();
        log(LOG_LEVELS.INFO, '数据库连接成功');
        connectionRetryCount = 0; // 重置重试计数
        return true;
    } catch (error) {
        connectionRetryCount++;
        log(LOG_LEVELS.ERROR, `数据库连接失败 (尝试 ${connectionRetryCount}/${maxRetries}): ${error.message}`);
        
        if (connectionRetryCount < maxRetries) {
            log(LOG_LEVELS.INFO, `将在 ${retryDelay/1000} 秒后重试...`);
            return false;
        } else {
            log(LOG_LEVELS.ERROR, '达到最大重试次数，数据库连接失败');
            return false;
        }
    }
}

// 重试数据库连接
async function retryDatabaseConnection() {
    const interval = setInterval(async () => {
        const connected = await connectToDatabase();
        if (connected) {
            clearInterval(interval);
            log(LOG_LEVELS.INFO, '数据库连接已恢复');
        } else if (connectionRetryCount >= maxRetries) {
            clearInterval(interval);
        }
    }, retryDelay);
}

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    log(LOG_LEVELS.ERROR, `未捕获的异常: ${err.message}\n${err.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(LOG_LEVELS.ERROR, `未处理的Promise拒绝: ${reason}\n${reason instanceof Error ? reason.stack : ''}`);
    process.exit(1);
});

// 启动服务器函数
async function startServer(httpServer) {
    // 从环境变量获取端口号，如果没有则使用配置文件中的端口
    const port = process.env.WORKER_PORT ? parseInt(process.env.WORKER_PORT) : parseInt(config.port) + 1;
    
    // 先尝试连接数据库
    const connected = await connectToDatabase();
    
    if (connected) {
        // 启动服务器
        httpServer.listen(port, () => {
            const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        });
    } else {
        // 如果初始连接失败，启动重试机制
        retryDatabaseConnection();
        
        // 即使数据库未连接也启动服务器，但会返回500错误
        httpServer.listen(port, () => {
            const workerId = processIds.get(process.pid) !== undefined ? processIds.get(process.pid) : 'unknown';
        });
    }
}

// 导出应用实例和模型
module.exports = { 
    app, 
    sequelize, 
    models,
    startServer
};