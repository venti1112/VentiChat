const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const redisClient = require('./redisClient');
const { log } = require('./logger');

/**
 * 生成JWT Token并存储到Redis
 * @param {Object} payload - JWT负载
 * @param {number} userId - 用户ID
 * @returns {string} Token字符串
 */
async function generateToken(payload, userId) {
    try {
        // 生成JWT Token，24小时后过期
        const token = jwt.sign(payload, config.encryptionKey, { expiresIn: '24h' });
        
        // 解码Token获取过期时间
        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000);
        
        // 存储到Redis
        await redisClient.storeUserToken(token, userId, expiresAt);
        
        return token;
    } catch (error) {
        log('ERROR', `生成Token失败: ${error.message}`);
        throw error;
    }
}

/**
 * 验证Token有效性
 * @param {string} token - Token字符串
 * @returns {Object|null} 用户信息或null
 */
async function verifyToken(token) {
    try {
        // 先验证JWT签名
        const decoded = jwt.verify(token, config.encryptionKey);
        
        // 再检查Redis中是否存在且有效
        const tokenInfo = await redisClient.validateToken(token);
        if (!tokenInfo) {
            return null; // Token不在Redis中或已过期
        }
        
        return {
            id: decoded.id || decoded.userId,
            userId: decoded.userId,
            username: decoded.username,
            exp: decoded.exp
        };
    } catch (error) {
        // JWT验证失败
        return null;
    }
}

/**
 * 移除Token
 * @param {string} token - Token字符串
 */
async function removeToken(token) {
    try {
        await redisClient.removeToken(token);
    } catch (error) {
        log('ERROR', `移除Token失败: ${error.message}`);
        throw error;
    }
}

/**
 * 移除用户所有Tokens
 * @param {number} userId - 用户ID
 */
async function removeAllUserTokens(userId) {
    try {
        await redisClient.removeAllUserTokens(userId);
    } catch (error) {
        log('ERROR', `移除用户所有Tokens失败: ${error.message}`);
        throw error;
    }
}

/**
 * 对密码进行哈希处理
 * @param {string} password - 明文密码
 * @returns {string} 哈希后的密码
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * 比较明文密码和哈希密码
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 哈希密码
 * @returns {boolean} 是否匹配
 */
async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
    generateToken,
    verifyToken,
    removeToken,
    removeAllUserTokens,
    hashPassword,
    comparePassword
};