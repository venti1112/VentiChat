const bcrypt = require('bcrypt');

/**
 * 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * 比较明文密码和哈希密码
 * @param {string} password - 明文密码
 * @param {string} hash - 哈希密码
 * @returns {Promise<boolean>} 比较结果
 */
async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    comparePassword
};