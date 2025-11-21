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
        isModerator: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_moderator' },
        note: { type: DataTypes.STRING(100), field: 'note' },
        lastReadMessageId: { type: DataTypes.INTEGER, defaultValue: 0, field: 'last_read_message_id' }
    }, {
        tableName: 'room_members',
        createdAt: 'join_time',
        updatedAt: false
    });

    RoomMember.associate = function(models) {
        // 定义与User和Room的关联
        RoomMember.belongsTo(models.User, { 
            foreignKey: 'user_id', 
            as: 'User' 
        });
        
        RoomMember.belongsTo(models.Room, { 
            foreignKey: 'room_id', 
            as: 'Room' 
        });
    };

    return RoomMember;
};