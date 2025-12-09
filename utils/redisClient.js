const redis = require('redis');
const config = require('../config/config.json');
const { log } = require('./logger');

// 创建Redis连接池配置
const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    // 连接池配置
    enableAutoPipelining: true,
    // 禁用内置重试机制，我们自己实现
    retryStrategy: () => false
};

// 创建Redis客户端实例
const redisClient = redis.createClient(redisConfig);

// 添加isRedisConnected属性并初始化为false
redisClient.isRedisConnected = false;

// 添加quiet模式属性，可通过setQuiet方法设置
let quiet = false;

// 设置quiet模式
redisClient.setQuiet = function(q) {
    quiet = q;
};

// Redis连接事件处理
redisClient.on('connect', () => {
    if (!quiet) {
        log('DEBUG', 'Redis客户端已连接');
    }
});

redisClient.on('ready', () => {
    if (!quiet) {
        log('DEBUG', 'Redis客户端准备就绪');
    }
    redisClient.isRedisConnected = true;
});

redisClient.on('error', (err) => {
    log('ERROR', `Redis错误: ${err.message}`);
});

redisClient.on('reconnecting', () => {
    log('INFO', 'Redis客户端重新连接中...');
});

redisClient.on('end', () => {
    log('INFO', 'Redis客户端连接已关闭，开始重试连接...');
    redisClient.isRedisConnected = false;
    // 当连接关闭时，启动我们的重试机制
    retryRedisConnection();
});

// 连接Redis
redisClient.connect().catch(err => {
    log('ERROR', `Redis初次连接失败: ${err.message}`);
    redisClient.isRedisConnected = false;
    // 启动重试机制
    retryRedisConnection();
});

// Redis连接重试函数 - 先尝试重连一次，如果失败则每5秒重试一次
let redisRetryInterval = null;

// 检查Redis连接状态的函数
function checkRedisConnection() {
    return isRedisConnected;
}

async function retryRedisConnection() {
    // 清除现有的重试定时器（如果有的话）
    if (redisRetryInterval) {
        clearInterval(redisRetryInterval);
        redisRetryInterval = null;
    }
    
    // 先尝试立即重连一次
    if (!quiet) {
        log('INFO', '尝试重新连接Redis...');
    }
    
    try {
        await redisClient.connect();
        log('INFO', 'Redis连接已恢复');
        isRedisConnected = true;
        redisClient.isRedisConnected = isRedisConnected; // 更新属性值
        return;
    } catch (err) {
        log('ERROR', `Redis重连失败: ${err.message}`);
        isRedisConnected = false;
        redisClient.isRedisConnected = isRedisConnected; // 更新属性值
    }
    
    // 每5秒重试一次
    redisRetryInterval = setInterval(async () => {
        try {
            await redisClient.connect();
            log('INFO', 'Redis连接已恢复');
            isRedisConnected = true;
            redisClient.isRedisConnected = isRedisConnected; // 更新属性值
            clearInterval(redisRetryInterval);
            redisRetryInterval = null;
        } catch (err) {
            log('ERROR', `Redis重连失败: ${err.message}`);
        }
    }, 5000);
}

/**
 * 存储用户Token
 * @param {string} tokenStr - Token字符串
 * @param {number} userId - 用户ID
 * @param {Date} expiresAt - 过期时间
 */
redisClient.storeUserToken = async function(tokenStr, userId, expiresAt) {
    try {
        const tokenData = {
            userId: userId,
            expiresAt: expiresAt.toISOString()
        };
        
        // 存储Token信息
        await this.setEx(`token:${tokenStr}`, Math.ceil((expiresAt - Date.now()) / 1000), JSON.stringify(tokenData));
        
        // 在用户Tokens集合中添加此Token
        await this.sAdd(`user_tokens:${userId}`, tokenStr);
    } catch (error) {
        log('ERROR', `存储用户Token失败: ${error.message}`);
        throw error;
    }
};

/**
 * 验证Token有效性
 * @param {string} tokenStr - Token字符串
 * @returns {object|null} Token信息或null
 */
redisClient.validateToken = async function(tokenStr) {
    try {
        const tokenDataStr = await this.get(`token:${tokenStr}`);
        if (!tokenDataStr) {
            return null;
        }
        
        const tokenData = JSON.parse(tokenDataStr);
        const expiresAt = new Date(tokenData.expiresAt);
        
        // 检查是否过期
        if (expiresAt < new Date()) {
            // 清理过期Token
            await this.removeToken(tokenStr);
            return null;
        }
        
        return {
            userId: tokenData.userId,
            expiresAt: expiresAt
        };
    } catch (error) {
        log('ERROR', `验证Token失败: ${error.message}`);
        return null;
    }
};

/**
 * 移除Token
 * @param {string} tokenStr - Token字符串
 */
redisClient.removeToken = async function(tokenStr) {
    try {
        const tokenDataStr = await this.get(`token:${tokenStr}`);
        if (tokenDataStr) {
            const tokenData = JSON.parse(tokenDataStr);
            // 从用户Tokens集合中移除
            await this.sRem(`user_tokens:${tokenData.userId}`, tokenStr);
        }
        // 删除Token
        await this.del(`token:${tokenStr}`);
    } catch (error) {
        log('ERROR', `移除Token失败: ${error.message}`);
        throw error;
    }
};

/**
 * 获取用户所有有效的Tokens
 * @param {number} userId - 用户ID
 * @returns {Array} Token列表
 */
redisClient.getUserTokens = async function(userId) {
    try {
        const tokens = await this.sMembers(`user_tokens:${userId}`);
        const validTokens = [];
        
        // 验证每个Token的有效性
        for (const token of tokens) {
            const tokenData = await this.validateToken(token);
            if (tokenData) {
                validTokens.push({
                    token: token,
                    userId: tokenData.userId,
                    expiresAt: tokenData.expiresAt
                });
            }
        }
        
        return validTokens;
    } catch (error) {
        log('ERROR', `获取用户Tokens失败: ${error.message}`);
        return [];
    }
};

/**
 * 移除用户所有Tokens
 * @param {number} userId - 用户ID
 */
redisClient.removeAllUserTokens = async function(userId) {
    try {
        const tokens = await this.sMembers(`user_tokens:${userId}`);
        const pipeline = this.multi();
        
        // 删除所有Tokens
        for (const token of tokens) {
            pipeline.del(`token:${token}`);
        }
        
        // 删除用户Tokens集合
        pipeline.del(`user_tokens:${userId}`);
        
        await pipeline.exec();
    } catch (error) {
        log('ERROR', `移除用户所有Tokens失败: ${error.message}`);
        throw error;
    }
};

/**
 * 添加封禁IP
 * @param {string} ip - IP地址
 * @param {Date} unbanTime - 解封时间
 * @param {number} failedAttempts - 失败尝试次数
 */
redisClient.addBannedIP = async function(ip, unbanTime, failedAttempts = 1) {
    try {
        const banData = {
            banTime: new Date().toISOString(),
            unbanTime: unbanTime.toISOString(),
            failedAttempts: failedAttempts
        };
        
        // 设置过期时间为解封时间之后一段时间，确保记录不会在封禁结束前被清除
        const expireTime = Math.max(Math.ceil((unbanTime - Date.now()) / 1000), 60);
        
        await this.setEx(
            `banned_ip:${ip}`, 
            expireTime, 
            JSON.stringify(banData)
        );
    } catch (error) {
        log('ERROR', `添加封禁IP失败: ${error.message}`);
        throw error;
    }
};

/**
 * 检查IP是否被封禁
 * @param {string} ip - IP地址
 * @returns {object|null} 封禁信息或null
 */
redisClient.checkBannedIP = async function(ip) {
    try {
        const banDataStr = await this.get(`banned_ip:${ip}`);
        if (!banDataStr) {
            return null;
        }
        
        const banData = JSON.parse(banDataStr);
        const unbanTime = new Date(banData.unbanTime);
        
        // 检查是否应该解封
        if (unbanTime < new Date()) {
            // 清理过期封禁
            await this.removeBannedIP(ip);
            return null;
        }
        
        return {
            banTime: new Date(banData.banTime),
            unbanTime: unbanTime,
            failedAttempts: banData.failedAttempts
        };
    } catch (error) {
        log('ERROR', `检查封禁IP失败: ${error.message}`);
        return null;
    }
};

/**
 * 移除封禁IP
 * @param {string} ip - IP地址
 */
redisClient.removeBannedIP = async function(ip) {
    try {
        await this.del(`banned_ip:${ip}`);
    } catch (error) {
        log('ERROR', `移除封禁IP失败: ${error.message}`);
        throw error;
    }
};

/**
 * 清除IP失败尝试次数记录
 * @param {string} ip - IP地址
 */
redisClient.clearIPFailures = async function(ip) {
    try {
        await this.del(`banned_ip:${ip}`);
    } catch (error) {
        log('ERROR', `清除IP失败记录失败: ${error.message}`);
        throw error;
    }
};

/**
 * 增加IP失败尝试次数
 * @param {string} ip - IP地址
 * @param {number} maxAttempts - 最大尝试次数
 * @param {number} lockTimeMinutes - 锁定时长（分钟）
 * @returns {object} 更新后的尝试次数信息
 */
redisClient.incrementIPFailures = async function(ip, maxAttempts, lockTimeMinutes) {
    try {
        const banInfo = await this.checkBannedIP(ip);
        let failedAttempts = 1;
        
        if (banInfo) {
            failedAttempts = banInfo.failedAttempts + 1;
        }
        
        // 只有在达到最大尝试次数时才封禁IP
        if (failedAttempts >= maxAttempts) {
            // 达到最大尝试次数，封禁IP
            const unbanTime = new Date(Date.now() + lockTimeMinutes * 60 * 1000);
            await this.addBannedIP(ip, unbanTime, failedAttempts);
            return {
                banned: true,
                failedAttempts: failedAttempts,
                unbanTime: unbanTime
            };
        } else {
            // 未达到最大尝试次数，仅记录失败次数但不解封IP
            // 使用较短的过期时间（例如30分钟）来自动清理这些记录
            const tempExpireTime = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期
            await this.addBannedIP(ip, tempExpireTime, failedAttempts);
            return {
                banned: false,
                failedAttempts: failedAttempts
            };
        }
    } catch (error) {
        log('ERROR', `增加IP失败尝试次数失败: ${error.message}`);
        throw error;
    }
};

module.exports = redisClient;