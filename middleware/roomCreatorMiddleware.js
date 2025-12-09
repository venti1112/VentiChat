const models = require('../models');
const { log } = require('../utils/logger');

/**
 * 检查用户是否为指定聊天室的创建者中间件
 * 服务器管理员和房间创建者都有权限
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Function} next - 下一步函数
 */
async function roomCreatorMiddleware(req, res, next) {
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
            // 系统管理员可以直接访问任何房间
            return next();
        }

        // 查找房间信息，检查用户是否为房间创建者
        const room = await models.Room.findOne({
            where: {
                roomId: roomId
            }
        });

        // 如果房间不存在
        if (!room) {
            return res.status(404).json({
                message: '房间不存在'
            });
        }

        // 检查用户是否为房间创建者
        if (room.creatorId !== req.user.userId) {
            return res.status(403).json({
                message: '您不是此房间的创建者'
            });
        }

        // 用户是房间创建者或系统管理员，继续执行
        next();
    } catch (error) {
        log('ERROR', `房间创建者检查中间件错误: ${error.message}`);
        return res.status(500).json({
            message: '服务器内部错误'
        });
    }
}

module.exports = roomCreatorMiddleware;