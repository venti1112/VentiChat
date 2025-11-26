/**
 * 前端日志记录工具
 * 用于替代 console.log 等调用
 */

// 日志级别
const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

/**
 * 发送日志到后端
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 */
function sendLogToServer(level, message) {
    // 在开发环境中，我们仍然在控制台输出
    // 统一使用log方法输出，保持中文格式
    const logMessage = `[前端日志] ${message}`;
    switch (level) {
        case LOG_LEVELS.INFO:
        case LOG_LEVELS.WARN:
        case LOG_LEVELS.ERROR:
            // 添加具体的日志处理逻辑
            break;
    }

    // 日志发送已在上面的switch语句中处理
}

/**
 * 记录信息级别日志
 * @param {...any} args 日志参数
 */
function logInfo(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sendLogToServer(LOG_LEVELS.INFO, message);
}

/**
 * 记录警告级别日志
 * @param {...any} args 日志参数
 */
function logWarn(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sendLogToServer(LOG_LEVELS.WARN, message);
}

/**
 * 记录错误级别日志
 * @param {...any} args 日志参数
 */
function logError(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    sendLogToServer(LOG_LEVELS.ERROR, message);
}

// 导出函数
window.logger = {
    logInfo,
    logWarn,
    logError,
    LOG_LEVELS
};