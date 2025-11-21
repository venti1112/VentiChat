const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

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

// 日志级别
const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

// 日志级别颜色映射
const levelColors = {
    [LOG_LEVELS.INFO]: colors.fg.green,
    [LOG_LEVELS.WARN]: colors.fg.yellow,
    [LOG_LEVELS.ERROR]: colors.fg.red
};

/**
 * 格式化时间戳
 * @returns {string} 格式化后的时间戳
 */
function getFormattedTimestamp() {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/\//g, '-');
}

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
        .replace(/(用户名: )([^,\n]+)/g, `$1${colors.fg.green}$2${colors.reset}`)
        .replace(/(结果: 成功)/g, `${colors.fg.green}$1${colors.reset}`)
        .replace(/(结果: 失败)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(原因: [^,\n]+)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(代码: [^,\n]+)/g, `${colors.fg.magenta}$1${colors.reset}`)
        .replace(/(状态码: [45]\d\d)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(状态码: [23]\d\d)/g, `${colors.fg.green}$1${colors.reset}`)
        .replace(/(信息: [^,\n]+)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(警告：使用浏览器开发者工具)/g, `${colors.fg.yellow}$1${colors.reset}`)
        .replace(/(\b401\b)/g, `${colors.fg.red}$1${colors.reset}`)
        .replace(/(\b403\b)/g, `${colors.fg.red}$1${colors.reset}`);
}

/**
 * 写入日志到文件和控制台
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 */
function log(level, message) {
    const timestamp = getFormattedTimestamp();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    // 输出到控制台（带颜色）
    const coloredLevel = `${levelColors[level] || ''}[${level}]${colors.reset}`;
    const coloredMessage = `[${timestamp}] ${coloredLevel} ${colorizeConsoleMessage(message)}`;
    
    switch (level) {
        case LOG_LEVELS.INFO:
            console.info(coloredMessage);
            break;
        case LOG_LEVELS.WARN:
            console.warn(coloredMessage);
            break;
        case LOG_LEVELS.ERROR:
            console.error(coloredMessage);
            break;
        default:
            console.log(coloredMessage);
    }
    
    // 异步写入文件（不带颜色）
    const logFileName = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}.log`;
    const logFilePath = path.join(logDir, logFileName);
    
    fs.appendFile(logFilePath, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
            console.error('日志写入文件失败:', err);
        }
    });
}

/**
 * 记录用户登录信息
 * 用户IP地址
 * @param {string} username 用户名
 * @param {boolean} success 是否登录成功
 * @param {string} errorMessage 错误信息（如果登录失败）
 */
function logUserLogin(ip, username, success, errorMessage = null) {
    if (success) {
        log(LOG_LEVELS.INFO, `用户登录 - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log(LOG_LEVELS.INFO, `用户登录 - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
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
        log(LOG_LEVELS.INFO, `用户退出登录 - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log(LOG_LEVELS.INFO, `用户退出登录 - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
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
        log(LOG_LEVELS.INFO, `用户连接Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log(LOG_LEVELS.INFO, `用户连接Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
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
        log(LOG_LEVELS.INFO, `用户断开Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 成功`);
    } else {
        log(LOG_LEVELS.INFO, `用户断开Socket.IO - IP: ${ip}, 用户名: ${username}, 结果: 失败, 原因: ${errorMessage}`);
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
 * 记录HTTP错误访问日志（如404、500等HTTP错误）
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 * @param {string} method HTTP方法（GET、POST等）
 * @param {string} url 请求的URL
 * @param {number} statusCode HTTP状态码
 * @param {string} message 错误信息
 */
function logHttpError(ip, username, method, url, statusCode, message) {
    log('ERROR', `HTTP错误 - IP: ${ip}, 用户名: ${username || '未知用户'}, 方法: ${method}, URL: ${url}, 状态码: ${statusCode}, 信息: ${message}`);
}

/**
 * 记录浏览器开发者工具相关警告
 * @param {string} ip 用户IP地址
 * @param {string} username 用户名
 */
function logBrowserDevToolsWarning(ip, username) {
    log('WARN', `浏览器开发者工具，IP: ${ip}, 用户名: ${username} , 警告：使用浏览器开发者工具`);
}

/**
 * 记录数据库查询日志
 * @param {string} query SQL查询语句
 */
function logDatabaseQuery(query) {
    const timestamp = getFormattedTimestamp();
    const logMessage = `[${timestamp}] [${LOG_LEVELS.INFO}] 数据库操作: ${query}\n`;
    
    // 只写入文件，不在控制台输出
    const logFileName = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}.log`;
    const logFilePath = path.join(logDir, logFileName);
    
    fs.appendFile(logFilePath, logMessage, { encoding: 'utf8' }, (err) => {
        if (err) {
            console.error('日志写入文件失败:', err);
        }
    });
}

module.exports = {
    logUserLogin,
    logUserLogout,
    logSocketConnect,
    logSocketDisconnect,
    logUnauthorizedAccess,
    logHttpError,
    logBrowserDevToolsWarning,
    logDatabaseQuery,
    log,
    LOG_LEVELS
};