const models = require('../models');
const { log } = require('../utils/logger');

/**
 * 检查用户是否为指定聊天室的成员中间件
 * 服务器管理员即使不是成员也放行
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一步函数
 */
async function roomMemberMiddleware(req, res, next) {
    try {
        // 检查用户是否已通过认证
        if (!req.user) {
            return res.status(401).json({
                message: '用户未认证'
            });
        }

        // 获取房间ID
        const roomId = req.params.roomId;
        
        // 检查房间ID是否存在
        if (!roomId) {
            return res.status(400).json({
                message: '缺少房间ID'
            });
        }

        // 检查用户是否为系统管理员
        if (req.user.isAdmin) {
            // 管理员可以直接访问任何房间
            return next();
        }

        // 检查用户是否为房间成员
        const roomMember = await models.RoomMember.findOne({
            where: {
                userId: req.user.userId,
                roomId: roomId
            }
        });

        // 如果用户不是房间成员，返回403错误
        if (!roomMember) {
            return res.status(403).json({
                message: '您不是此房间的成员'
            });
        }

        // 用户是房间成员或管理员，继续执行
        next();
    } catch (error) {
        log('ERROR', `房间成员检查中间件错误: ${error.message}`);
        return res.status(500).json({
            message: '服务器内部错误'
        });
    }
}

module.exports = roomMemberMiddleware;