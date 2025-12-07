module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Message = sequelize.define('Message', {
        messageId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true,
            field: 'message_id'
        },
        roomId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'room_id'
        },
        userId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'user_id'
        },
        content: { 
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'content'
        },
        type: { 
            type: DataTypes.ENUM('text', 'image', 'video', 'file', 'audio'), 
            defaultValue: 'text',
            allowNull: true,
            field: 'type'
        },
        fileUrl: { 
            type: DataTypes.STRING(255), 
            field: 'file_url',
            allowNull: true
        },
        fileSize: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'file_size'
        },
        isDeleted: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: false, 
            field: 'is_deleted',
            allowNull: true
        },
        sentAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'sent_at'
        }
    }, {
        tableName: 'messages',
        timestamps: false
    });

    Message.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return Message;
};

