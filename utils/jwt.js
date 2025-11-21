const jwt = require('jsonwebtoken');
const config = require('../config/config.json');

/**
 * 生成 JWT token
 * @param {Object} payload - 要编码的数据
 * @param {string} expiresIn - 过期时间
 * @returns {string} JWT token
 */
function generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, config.encryptionKey, { expiresIn });
}

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {Object|false} 解码后的数据或 false（如果验证失败）
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, config.encryptionKey);
    } catch (error) {
        return false;
    }
}

module.exports = {
    generateToken,
    verifyToken
};