module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Message = sequelize.define('Message', {
        content: { type: DataTypes.TEXT },
        type: { type: DataTypes.ENUM('text', 'image', 'video', 'file'), defaultValue: 'text' },
        fileUrl: { type: DataTypes.STRING(255) },
        isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
    }, {
        tableName: 'Messages',
        createdAt: 'sent_at',
        updatedAt: false
    });

    Message.associate = function(models) {
        Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'Sender' });
        Message.belongsTo(models.Room, { foreignKey: 'roomId', as: 'MessageRoom' });
    };

    return Message;
};





