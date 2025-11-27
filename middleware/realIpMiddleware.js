const { log } = require('../utils/logger');

/**
 * 从反向代理获取真实客户端IP地址的中间件
 * 支持多种常见的代理头部字段
 */
function realIpMiddleware(req, res, next) {
    // 按照优先级顺序获取真实IP地址
    const realIP = 
        // Nginx等常用的X-Real-IP头部
        req.headers['x-real-ip'] ||
        // RFC 7239标准定义的Forwarded头部，解析其中的for字段
        (req.headers['forwarded'] ? parseForwardedHeader(req.headers['forwarded']) : null) ||
        // 常见的X-Forwarded-For头部（可能包含多个IP，取第一个）
        (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
        // CloudFlare的CDN头部
        req.headers['cf-connecting-ip'] ||
        // 其他云服务商使用的头部
        req.headers['true-client-ip'] ||
        // Express.js内置解析的IP
        req.ip ||
        // Node.js原生连接地址
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        // 默认值
        'unknown';

    // 将真实IP地址存储到请求对象中
    req.realIP = realIP;
    
    next();
}

/**
 * 解析Forwarded头部 (RFC 7239)
 * @param {string} forwardedHeader - Forwarded头部的值
 * @returns {string|null} 解析出的IP地址或者null
 */
function parseForwardedHeader(forwardedHeader) {
    try {
        // 匹配 "for=" 后面的IP地址
        const match = forwardedHeader.match(/for=([^;,]+)/i);
        if (match && match[1]) {
            // 移除可能存在的引号和端口号
            return match[1].replace(/"/g, '').split(':')[0];
        }
        return null;
    } catch (error) {
        return null;
    }
}

module.exports = realIpMiddleware;