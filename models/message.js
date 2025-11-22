module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Message = sequelize.define('Message', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        senderId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'sender_id'
        },
        roomId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'room_id'
        },
        content: { 
            type: DataTypes.TEXT,
            allowNull: true
        },
        type: { 
            type: DataTypes.ENUM('text', 'image', 'video', 'file'), 
            defaultValue: 'text',
            allowNull: true
        },
        fileUrl: { 
            type: DataTypes.STRING(255), 
            field: 'file_url',
            allowNull: true
        },
        isDeleted: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: false, 
            field: 'is_deleted',
            allowNull: true
        }
    }, {
        tableName: 'messages', // 注意这里改为小写，与实际表名一致
        createdAt: 'sent_at',
        updatedAt: false
    });

    Message.associate = function(models) {
        Message.belongsTo(models.User, {
            foreignKey: 'senderId',
            as: 'Sender'
        });
        
        Message.belongsTo(models.Room, {
            foreignKey: 'roomId',
            as: 'Room'
        });
        
    };

    return Message;
};

