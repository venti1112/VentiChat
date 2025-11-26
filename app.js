// 导入依赖
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Sequelize } = require('sequelize'); // 只导入Sequelize类
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const config = require('./config/config.json');
const { log, logHttpError, logDatabaseQuery, logDatabaseRetry, logBrowserDevToolsWarning, LOG_LEVELS } = require('./utils/logger');

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
    JoinRequest: require('./models/joinRequest')(sequelize),
    Token: require('./models/token')(sequelize),
    SystemSetting: require('./models/systemSetting')(sequelize),
    BanIp: require('./models/banIp')(sequelize)
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/userdata', express.static(path.join(__dirname, 'public', 'userdata')));

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

// 用户Socket映射
const userSocketMap = new Map();
// 将userSocketMap挂载到app上
app.set('userSocketMap', userSocketMap);

// 数据库连接状态
let isDatabaseConnected = false;

// 中间件：检查数据库连接状态
app.use(async (req, res, next) => {
    if (!isDatabaseConnected) {
        // 记录500错误访问日志
        const clientIP = req.ip || req.connection.remoteAddress || 
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
    const clientIP = req.ip || req.connection.remoteAddress || 
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
    const clientIP = req.ip || req.connection.remoteAddress || 
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
    
    logHttpError(clientIP, username, method, url, 500, err.message || '内部服务器错误');
    
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
        
        // log('INFO', '正在同步数据库...');
        // await sequelize.sync({ alter: true });
        // log('INFO', '数据库同步完成');
        
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
        log('INFO', '尝试重新连接数据库...');
        const connected = await connectToDatabase();
        
        if (!connected) {
            logDatabaseRetry();
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
}

// 错误处理
process.on('unhandledRejection', (err) => {
    log('ERROR', '未处理的Promise拒绝: ' + err);
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
        log('INFO', '数据库初始连接失败，系统将在三分钟后重试');
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
                // Token有效但用户不存在
                log('WARN', `Socket.IO连接被拒绝 - IP: ${clientIP}, 原因: 用户不存在`);
                socket.emit('unauthorized', { message: '用户不存在' });
                socket.disconnect(true);
                return;
            }
        } catch (error) {
            log('WARN', `Socket.IO连接token验证失败 - IP: ${clientIP}, 错误: ${error.message}`);
            socket.emit('unauthorized', { message: '令牌无效' });
            socket.disconnect(true);
            return;
        }
    } else {
        // 没有提供token
        log('WARN', `Socket.IO连接被拒绝 - IP: ${clientIP}, 原因: 缺少访问令牌`);
        socket.emit('unauthorized', { message: '缺少访问令牌' });
        socket.disconnect(true);
        return;
    }
    
    // 记录连接日志
    log('INFO', `用户连接Socket.IO - IP: ${clientIP}, 用户名: ${username}, 结果: 成功`);
    
    // 获取用户ID并建立映射
    userSocketMap.set(userId, socket.id);
    
    // 断开连接时清除映射
    socket.on('disconnect', () => {
        userSocketMap.delete(userId);
        log('INFO', `用户断开Socket.IO - IP: ${clientIP}, 用户名: ${username}, 结果: 成功`);
    });

    // 加入聊天室
    socket.on('joinRoom', (data) => {
        // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
        const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
        if (roomId) {
            socket.join(`room_${roomId}`);
            log('INFO', `用户 ${username} 加入聊天室 ${roomId}`);
        }
    });
    
    // 离开聊天室
    socket.on('leaveRoom', (data) => {
        // 兼容两种数据格式：直接传roomId或传{roomId: ...}对象
        const roomId = typeof data === 'object' ? data.rid || data.roomId : data;
        if (roomId) {
            socket.leave(`room_${roomId}`);
            log('INFO', `用户 ${username} 离开聊天室 ${roomId}`);
        }
    });
});

// 启动服务器
startServer();