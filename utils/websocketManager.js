const redisClient = require('./redisClient');
const { log, LOG_LEVELS } = require('./logger');
const cluster = require('cluster');

class WebSocketManager {
    /**
     * 存储用户Socket连接信息到Redis
     * @param {string} userId - 用户ID
     * @param {string} socketId - Socket ID
     * @param {number} workerId - 工作进程ID
     */
    static async storeUserSocket(userId, socketId, workerId) {
        try {
            const socketInfo = {
                socketId,
                workerId,
                timestamp: Date.now()
            };
            
            // 存储用户到Socket的映射
            await redisClient.hSet(`user:${userId}`, workerId.toString(), JSON.stringify(socketInfo));
            
            // 存储Socket到用户的映射，方便快速查找
            await redisClient.set(`socket:${socketId}`, userId);
            
            log(LOG_LEVELS.DEBUG, `存储用户Socket信息: 用户=${userId}, Socket=${socketId}, 工作进程=${workerId}`);
        } catch (error) {
            log(LOG_LEVELS.ERROR, `存储用户Socket信息失败: ${error.message}`);
        }
    }

    /**
     * 从Redis中删除用户Socket连接信息
     * @param {string} userId - 用户ID
     * @param {string} socketId - Socket ID
     * @param {number} workerId - 工作进程ID
     */
    static async removeUserSocket(userId, socketId, workerId) {
        try {
            // 删除用户到Socket的映射
            await redisClient.hDel(`user:${userId}`, workerId.toString());
            
            // 删除Socket到用户的映射
            await redisClient.del(`socket:${socketId}`);
            
            log(LOG_LEVELS.DEBUG, `删除用户Socket信息: 用户=${userId}, Socket=${socketId}, 工作进程=${workerId}`);
        } catch (error) {
            log(LOG_LEVELS.ERROR, `删除用户Socket信息失败: ${error.message}`);
        }
    }

    /**
     * 获取用户的所有Socket连接信息
     * @param {string} userId - 用户ID
     * @returns {Array} 用户的所有Socket连接信息
     */
    static async getUserSockets(userId) {
        try {
            const sockets = [];
            const socketData = await redisClient.hGetAll(`user:${userId}`);
            
            for (const workerId in socketData) {
                const socketInfo = JSON.parse(socketData[workerId]);
                sockets.push({
                    workerId: parseInt(workerId),
                    socketId: socketInfo.socketId,
                    timestamp: socketInfo.timestamp
                });
            }
            
            return sockets;
        } catch (error) {
            log(LOG_LEVELS.ERROR, `获取用户Socket信息失败: ${error.message}`);
            return [];
        }
    }

    /**
     * 向特定用户的所有连接发送消息
     * @param {string} userId - 用户ID
     * @param {string} event - 事件名称
     * @param {any} data - 消息数据
     * @param {SocketIO.Server} io - Socket.IO服务器实例
     */
    static async sendToUser(userId, event, data, io) {
        try {
            const sockets = await this.getUserSockets(userId);
            
            for (const socketInfo of sockets) {
                // 如果Socket在同一工作进程中，直接发送
                const socket = io.sockets.sockets.get(socketInfo.socketId);
                if (socket) {
                    socket.emit(event, data);
                } else {
                    // 如果Socket在不同工作进程中，通过主进程转发消息
                    if (cluster.isWorker) {
                        process.send({
                            type: 'forwardToWorker',
                            targetWorkerId: socketInfo.workerId,
                            eventType: 'emitToSocket',
                            socketId: socketInfo.socketId,
                            event,
                            data
                        });
                    }
                }
            }
        } catch (error) {
            log(LOG_LEVELS.ERROR, `向用户发送消息失败: ${error.message}`);
        }
    }

    /**
     * 获取Socket关联的用户ID
     * @param {string} socketId - Socket ID
     * @returns {string|null} 用户ID或null
     */
    static async getUserIdBySocket(socketId) {
        try {
            const userId = await redisClient.get(`socket:${socketId}`);
            return userId;
        } catch (error) {
            log(LOG_LEVELS.ERROR, `获取Socket关联用户失败: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 向指定Socket发送消息（由主进程转发调用）
     * @param {string} socketId - Socket ID
     * @param {string} event - 事件名称
     * @param {any} data - 消息数据
     * @param {SocketIO.Server} io - Socket.IO服务器实例
     */
    static emitToSocket(socketId, event, data, io) {
        try {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit(event, data);
            }
        } catch (error) {
            log(LOG_LEVELS.ERROR, `向Socket发送消息失败: ${error.message}`);
        }
    }
}

module.exports = WebSocketManager;