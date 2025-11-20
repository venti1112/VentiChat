module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Message = sequelize.define('Message', {
        content: { type: DataTypes.TEXT },
        type: { type: DataTypes.ENUM('text', 'image', 'video', 'file'), defaultValue: 'text' },
        fileUrl: { type: DataTypes.STRING(255), field: 'file_url' },
        isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_deleted' }
    }, {
        tableName: 'Messages',
        createdAt: 'sent_at',
        updatedAt: false
    });

    Message.associate = function(models) {
        // 移除可能导致循环依赖的关联，在需要的地方使用原始查询
    };

    return Message;
};









