const rateLimit = require('express-rate-limit');

// 消息发送的频率限制 - 每分钟最多10条消息
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 限制每个用户每分钟最多发送10条消息
  message: {
    error: '发送消息过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 使用用户ID而不是IP地址作为限流标识，这样更准确
    if (req.user) {
      return String(req.user.userId);
    }
    // 对于未认证的用户，返回null让express-rate-limit使用默认的IP处理方式
    return null;
  },
  skip: function (req, res) {
    // 管理员用户不受速率限制
    return req.user && req.user.isAdmin;
  }
});

module.exports = {
  messageRateLimiter
};