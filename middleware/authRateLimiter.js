const rateLimit = require('express-rate-limit');

// 登录速率限制 - 每15分钟最多5次尝试
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP每15分钟最多5次登录尝试
  message: {
    error: '登录尝试次数过多，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 对于登录，我们基于IP地址进行限制（因为此时用户尚未认证）
    return null; // 使用express-rate-limit默认的IP处理方式
  }
});

// 注册速率限制 - 每小时最多3次注册
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 限制每个IP每小时最多3次注册
  message: {
    error: '注册尝试次数过多，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 对于注册，我们基于IP地址进行限制
    return null; // 使用express-rate-limit默认的IP处理方式
  }
});

module.exports = {
  loginRateLimiter,
  registerRateLimiter
};