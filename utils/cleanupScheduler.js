// utils/cleanupScheduler.js
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { log } = require('./logger');
const { Op } = require('sequelize');

// 默认保存期限（天）
const DEFAULT_RETENTION_DAYS = 180;

// 清理过期消息和文件
const cleanupExpiredData = async (models, app) => {
    try {
        log('INFO', '开始清理过期数据...');
        
        // 获取保存期限配置（可从数据库或环境变量获取）
        const retentionDays = process.env.MESSAGE_RETENTION_DAYS ? parseInt(process.env.MESSAGE_RETENTION_DAYS) : DEFAULT_RETENTION_DAYS;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        // 查找需要删除的消息
        const expiredMessages = await models.Message.findAll({
            where: {
                sentAt: { [Op.lt]: cutoffDate }
            },
            attributes: ['messageId', 'type', 'fileUrl']
        });
        
        if (expiredMessages.length === 0) {
            log('INFO', '没有过期数据需要清理');
            return;
        }
        
        // 收集需要删除的文件路径
        const filesToDelete = [];
        for (const message of expiredMessages) {
            if (message.fileUrl) {
                // 将URL转换为本地文件路径
                const filePath = path.join(__dirname, '..', 'public', message.fileUrl);
                filesToDelete.push({
                    messageId: message.messageId,
                    filePath
                });
            }
        }
        
        // 先删除文件
        let filesDeleted = 0;
        for (const file of filesToDelete) {
            try {
                if (fs.existsSync(file.filePath)) {
                    fs.unlinkSync(file.filePath);
                    filesDeleted++;
                }
            } catch (error) {
                log('ERROR', `删除文件失败 ${file.filePath}: ${error.message}`);
            }
        }
        
        // 再删除消息记录
        const messagesDeleted = await models.Message.destroy({
            where: {
                messageId: expiredMessages.map(m => m.messageId)
            }
        });
        
        log('INFO', `清理完成：删除了 ${messagesDeleted} 条消息，${filesDeleted} 个文件`);
        
        // 可选：通过Socket.IO通知管理员
        const io = app.get('io');
        if (io) {
            io.emit('cleanupReport', {
                timestamp: new Date(),
                messagesDeleted,
                filesDeleted
            });
        }
        
    } catch (error) {
        log('ERROR', '清理过期数据时出错: ' + error);
    }
};

// 启动定时任务
const startCleanupScheduler = (models, app) => {
    // 每天凌晨4点执行
    // Cron表达式：0 0 4 * * * （秒 分 时 日 月 星期）
    cron.schedule('0 0 4 * * *', () => {
        cleanupExpiredData(models, app);
    }, {
        scheduled: true,
        timezone: 'Asia/Shanghai' // 设置时区
    });
    
    log('INFO', '定时清理任务已启动，每天凌晨4点执行');
    
    // 立即执行一次用于测试（可注释掉）
    // cleanupExpiredData(models, app);
};

module.exports = startCleanupScheduler;