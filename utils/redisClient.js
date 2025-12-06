const redis = require('redis');
const config = require('../config/config.json');
const { log, LOG_LEVELS } = require('./logger');

// 创建Redis连接池配置
const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    // 连接池配置
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true
};

// 创建Redis客户端实例
const redisClient = redis.createClient(redisConfig);

// Redis连接事件处理
redisClient.on('connect', () => {
    log(LOG_LEVELS.INFO, 'Redis客户端已连接');
});

redisClient.on('ready', () => {
    log(LOG_LEVELS.INFO, 'Redis客户端准备就绪');
});

redisClient.on('error', (err) => {
    log(LOG_LEVELS.ERROR, `Redis错误: ${err.message}`);
});

redisClient.on('reconnecting', () => {
    log(LOG_LEVELS.INFO, 'Redis客户端重新连接中...');
});

redisClient.on('end', () => {
    log(LOG_LEVELS.INFO, 'Redis客户端连接已关闭');
});

// 连接Redis
redisClient.connect().catch(err => {
    log(LOG_LEVELS.ERROR, `Redis连接失败: ${err.message}`);
});

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
        log(LOG_LEVELS.ERROR, `存储用户Token失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `验证Token失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `移除Token失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `获取用户Tokens失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `移除用户所有Tokens失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `添加封禁IP失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `检查封禁IP失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `移除封禁IP失败: ${error.message}`);
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
        log(LOG_LEVELS.ERROR, `清除IP失败记录失败: ${error.message}`);
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
            // 更新失败次数，设置较长的过期时间（例如30分钟）
            // 这样可以在一定时间后自动清除未达到封禁条件的记录
            const tempUnbanTime = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期
            await this.addBannedIP(ip, tempUnbanTime, failedAttempts);
            return {
                banned: false,
                failedAttempts: failedAttempts
            };
        }
    } catch (error) {
        log(LOG_LEVELS.ERROR, `增加IP失败尝试次数失败: ${error.message}`);
        throw error;
    }
};

module.exports = redisClient;