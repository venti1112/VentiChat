const { Sequelize } = require('sequelize');
const config = require('../config/config.json');
const { log } = require('./logger');

// 创建Sequelize实例
const sequelize = new Sequelize(
    config.db.database,
    config.db.user,
    config.db.password,
    {
        host: config.db.host,
        port: config.db.port,
        dialect: 'mysql',
        logging: false, // 禁用SQL日志输出
        pool: {
            max: 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            charset: 'utf8mb4',
            connectTimeout: 60000
        },
        timezone: '+08:00' // 设置时区为东八区
    }
);

// 数据库连接状态
let isDatabaseConnected = false;
let databaseCheckInterval = null;
const retryDelay = 5000; // 重试延迟时间，5秒

async function connectToDatabase() {
    try {
        await sequelize.authenticate();
        log('DEBUG', '数据库连接成功');
        isDatabaseConnected = true;
        return true;
    } catch (error) {
        log('ERROR', `数据库连接失败: ${error.message}`);
        isDatabaseConnected = false;
        return false;
    }
}

// 检查数据库连接状态的函数
async function checkDatabaseConnection() {
    try {
        await sequelize.query('SELECT 1');
        if (!isDatabaseConnected) {
            log('INFO', '数据库连接已恢复');
            isDatabaseConnected = true;
        }
        return true;
    } catch (error) {
        if (isDatabaseConnected) {
            log('ERROR', `数据库连接丢失: ${error.message}`);
            isDatabaseConnected = false;
            log('INFO', '启动数据库重连机制...');
            retryDatabaseConnection();
        }
        return false;
    }
}

// 重试数据库连接 - 先尝试重连一次，如果失败则每5秒重试一次
let retryIntervalId = null;

async function retryDatabaseConnection() {
    // 清除现有的重试定时器（如果有的话）
    if (retryIntervalId) {
        clearInterval(retryIntervalId);
        retryIntervalId = null;
    }
    
    // 先尝试立即重连一次
    log('INFO', '尝试重新连接数据库...');
    let connected = await connectToDatabase();
    if (connected) {
        log('INFO', '数据库连接已恢复');
        return;
    }
    
    log('INFO', `将在 ${retryDelay/1000} 秒后继续重试...`);
    
    // 每5秒重试一次
    retryIntervalId = setInterval(async () => {
        const connected = await connectToDatabase();
        if (connected) {
            clearInterval(retryIntervalId);
            retryIntervalId = null;
            log('INFO', '数据库连接已恢复');
        } else {
            log('INFO', `将在 ${retryDelay/1000} 秒后继续重试...`);
        }
    }, retryDelay);
}

// 启动定期检查数据库连接状态的任务
function startDatabaseHealthCheck() {
    if (databaseCheckInterval) {
        clearInterval(databaseCheckInterval);
    }
    databaseCheckInterval = setInterval(checkDatabaseConnection, 30000); // 每30秒检查一次
}

// 初始化数据库连接
connectToDatabase().catch(err => {
    log('ERROR', `数据库初次连接失败: ${err.message}`);
    // 启动重试机制
    retryDatabaseConnection();
});

// 导出sequelize实例和连接状态
module.exports = {
    sequelize: sequelize,
    isDatabaseConnected: () => isDatabaseConnected,
    connectToDatabase,
    checkDatabaseConnection,
    retryDatabaseConnection,
    startDatabaseHealthCheck
};