const rateLimit = require('express-rate-limit');

// 普通用户发送消息的频率限制 - 每分钟最多10条消息
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

// VIP用户或管理员有更高的限制 - 每分钟最多30条消息
const vipMessageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30,
  message: {
    error: '发送消息过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user) {
      return String(req.user.userId);
    }
    // 对于未认证的用户，返回null让express-rate-limit使用默认的IP处理方式
    return null;
  },
  skip: function (req, res) {
    // 管理员使用这个较高的限制
    return req.user && (req.user.isAdmin);
  }
});

// 防止恶意刷消息的严格限制 - 每小时最多50条消息
const strictMessageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 50,
  message: {
    error: '达到消息发送上限，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user) {
      return String(req.user.userId);
    }
    // 对于未认证的用户，返回null让express-rate-limit使用默认的IP处理方式
    return null;
  }
});

module.exports = {
  messageRateLimiter,
  vipMessageRateLimiter,
  strictMessageRateLimiter
};