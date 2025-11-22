module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const RoomMember = sequelize.define('RoomMember', {
        userId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true,
            field: 'user_id'
        },
        roomId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true,
            field: 'room_id'
        },
        isModerator: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: false, 
            field: 'is_moderator' 
        },
        note: { 
            type: DataTypes.STRING(100), 
            field: 'note' 
        },
        lastReadMessageId: { 
            type: DataTypes.INTEGER, 
            defaultValue: 0, 
            field: 'last_read_message_id' 
        },
        joinTime: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'join_time'
        }
    }, {
        tableName: 'room_members',
        timestamps: false
    });

    RoomMember.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return RoomMember;
};