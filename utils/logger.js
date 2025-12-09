const fs = require('fs');
const path = require('path');
const cluster = require('cluster');

// 安全地加载配置文件，如果不存在则使用默认配置
let config;
try {
    config = require('../config/config.json');
} catch (error) {
    // 如果配置文件不存在，则使用默认配置
    config = {
        logLevel: 'INFO' // 默认为INFO级别
    };
}

// 确保日志目录存在
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 进程编号映射 - 使用 cluster.worker.id 作为进程ID
const processIds = new Map();

// ANSI颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
    },
    
    bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
    }
};

// 获取当前时间戳
function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// 日志级别颜色映射
const levelColors = {
    ERROR: colors.fg.red,
    WARN: colors.fg.yellow,
    INFO: colors.fg.green,
    DEBUG: colors.fg.blue
};

/**
 * 为控制台输出添加颜色
 * @param {string} message 日志消息
 * @returns {string} 添加颜色后的消息
 */
function colorizeConsoleMessage(message) {
    return message
        .replace(/(IP: )([\d\.]+)/g, `$1${colors.fg.blue}$2${colors.reset}`)
        .replace(/(IP地址: )([\d\.]+)/g, `$1${colors.fg.blue}$2${colors.reset}`)
        .replace(/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g, `${colors.fg.blue}$1${colors.reset}`)
        .replace(/(\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b)/g, `${colors.fg.blue}$1${colors.reset}`)
        .replace(/(\b(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b)/g, `${colors.fg.blue}$1${colors.reset}`)
        .replace(/(\b(?:[0-9a-fA-F]{1,4}:)+:(?:[0-9a-fA-F]{1,4})?\b)/g, `${colors.fg.blue}$1${colors.reset}`)
        .replace(/(\b::1\b)/g, `${colors.fg.blue}$1${colors.reset}`)
        .replace(/(用户: |用户名: )([^,\n]+)/g, `$1${colors.fg.green}$2${colors.reset}`)
        .replace(/(结果: 成功)/g, `${colors.fg.green}$1${colors.reset}`)
        .replace(/(结果: 失败)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(原因: [^,\n]+)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(代码: [^,\n]+)/g, `${colors.fg.magenta}$1${colors.reset}`)
        .replace(/(状态码: [45]\d\d)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(状态码: [23]\d\d)/g, `${colors.fg.green}$1${colors.reset}`)
        .replace(/(信息: [^,\n]+)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(错误: [^,\n]+)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(警告：使用浏览器开发者工具)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(\b401\b)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(\b403\b)/g, `${colors.fg.red}$1${colors.reset}`);
}

/**
 * 格式化日志消息
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 * @returns {string} 格式化后的日志消息
 */
function formatMessage(level, message) {
    const timestamp = getTimestamp();
    const levelName = level; // 使用传入的实际日志级别而不是配置的日志级别
    const processInternalId = processIds.has(process.pid) ? processIds.get(process.pid) : process.pid;
    
    // 确定进程类型
    let processType = '未知进程';
    if (cluster.isMaster || cluster.isPrimary) {
        // 特殊处理代理进程 - 通过进程标题判断
        if (process.title && process.title.includes('proxy')) {
            processType = '代理进程';
        } else {
            processType = '主进程';
        }
    } else if (cluster.isWorker) {
        processType = '工作进程';
    } else if (processIds.has(process.pid)) {
        processType = '工作进程'; // 通过ID判断为工作进程
    }
    
    // 对于主进程，不显示ID；对于代理进程，显示特殊标识；对于工作进程，显示其ID
    if (processType === '主进程') {
        return `[${timestamp}] [${levelName}] [${processType}] ${message}`;
    } else if (processType === '代理进程') {
        return `[${timestamp}] [${levelName}] [${processType}] ${message}`;
    } else {
        return `[${timestamp}] [${levelName}] [${processType}:${processInternalId}] ${message}`;
    }
}

/**
 * 主日志函数
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 */
function log(level, message) {
    // 从配置中获取日志级别，如果未设置则默认为 INFO
    let configLogLevel = config.logLevel !== undefined ? config.logLevel : 'INFO';
    
    if(configLogLevel === 'INFO' && level === 'DEBUG'){
        return;
    } else if(configLogLevel === 'WARN' && (level === 'DEBUG' || level === 'INFO')){
        return;
    } else if(configLogLevel === 'ERROR' && (level === 'DEBUG' || level === 'INFO' || level === 'WARN')){
        return;
    }

    
    const formattedMessage = formatMessage(level, message);
    const coloredLevel = `${levelColors[config.logLevel] || ''}[${config.logLevel}]${colors.reset}`;
    const coloredMessage = formattedMessage.replace(`[${config.logLevel}]`, coloredLevel);
    
    // 输出到控制台（带颜色）
    console.log(colorizeConsoleMessage(coloredMessage));
    
    // 异步写入文件（不带颜色）
    const logFileName = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}.log`;
    const logFilePath = path.join(logDir, logFileName);
    const fileLogMessage = `[${getTimestamp()}] [${config.logLevel}] ${message}\n`;
    
    fs.appendFile(logFilePath, fileLogMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
            console.error(`[${getTimestamp()}] [ERROR] 日志写入文件失败: ${err.message}`);
        }
    });
}

/**
 * 记录用户登录信息
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {boolean} success 是否登录成功
 * @param {string} errorMessage 错误信息（如果登录失败）
 */
function logUserLogin(ip, username, success, errorMessage = null) {
    if (success) {
        log('INFO', `用户登录 - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log('WARN', `用户登录 - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
    }
}

/**
 * 记录用户退出登录信息
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {boolean} success 是否退出成功
 * @param {string} errorMessage 错误信息（如果退出失败）
 */
function logUserLogout(ip, username, success, errorMessage = null) {
    if (success) {
        log('INFO', `用户退出登录 - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log('WARN', `用户退出登录 - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
    }
}

/**
 * 记录用户连接Socket.IO信息
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {boolean} success 是否连接成功
 * @param {string} errorMessage 错误信息（如果连接失败）
 */
function logSocketConnect(ip, username, success, errorMessage = null) {
    if (success) {
        log('INFO', `用户连接Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log('WARN', `用户连接Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
    }
}

/**
 * 记录用户断开Socket.IO连接信息
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {boolean} success 是否断开成功
 * @param {string} errorMessage 错误信息（如果断开失败）
 */
function logSocketDisconnect(ip, username, success, errorMessage = null) {
    if (success) {
        log('INFO', `用户断开Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log('WARN', `用户断开Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
    }
}

/**
 * 记录异常访问日志
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名（如未知用户则为"未知用户"）
 * @param {string} method HTTP方法（GET、POST等）
 * @param {string} path 请求路径
 * @param {number} statusCode HTTP状态码
 * @param {string} errorMessage 错误信息
 */
function logUnauthorizedAccess(ip, username, method, path, statusCode, errorMessage) {
    log('WARN', `异常访问 - IP: ${ip}, 用户名: ${username}, 方法: ${method}, 路径: ${path}, 状态码: ${statusCode}, 原因: ${errorMessage}`);
}

/**
 * HTTP错误日志记录函数
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {string} method HTTP方法（GET、POST等）
 * @param {string} url 请求的URL
 * @param {number} statusCode HTTP状态码
 * @param {string} errorMessage 错误信息
 */
function logHttpError(ip, username, method, url, statusCode, errorMessage) {
    let level = 'INFO';
    if (statusCode >= 500) level = 'ERROR';
    else if (statusCode >= 400) level = 'WARN';
    
    log(level, `HTTP ${statusCode} - IP: ${ip}, 用户: ${username || '未知用户'}, 方法: ${method}, URL: ${url}, 错误: ${errorMessage}`);
}

/**
 * 数据库查询日志记录函数
 * @param {string} message 查询信息
 */
function logDatabaseQuery(message) {
    // 仅在DEBUG级别时记录数据库查询
    if (config.logLevel >= 'DEBUG') {
        log('DEBUG', `数据库查询: ${message}`);
    }
}

/**
 * 数据库重试日志记录函数
 */
function logDatabaseRetry() {
    log('INFO', '数据库连接重试中...');
}

/**
 * 浏览器开发者工具警告日志记录函数
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 */
function logBrowserDevToolsWarning(ip, username) {
    log('DEBUG', `浏览器开发者工具探测 - IP: ${ip}, 用户: ${username}`);
}


// 在进程启动时分配ID - 使用 cluster.worker.id 作为工作进程ID
if (cluster.isMaster || cluster.isPrimary) {
    // 主进程使用ID 0
    processIds.set(process.pid, 0);
} else if (cluster.worker) {
    // 工作进程使用 cluster 模块提供的 id
    processIds.set(process.pid, cluster.worker.id);
} else {
    // 如果既不是主进程也没有worker信息，则使用PID作为ID
    processIds.set(process.pid, process.pid);
}


module.exports = {
    log,
    logUserLogin,
    logUserLogout,
    logSocketConnect,
    logSocketDisconnect,
    logUnauthorizedAccess,
    logHttpError,
    logDatabaseQuery,
    logDatabaseRetry,
    logBrowserDevToolsWarning,
    processIds
};