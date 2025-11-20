module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const RoomMember = sequelize.define('RoomMember', {
        isModerator: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_moderator' },
        note: { type: DataTypes.STRING(100), field: 'note' },
        lastReadMessageId: { type: DataTypes.INTEGER, defaultValue: 0, field: 'last_read_message_id' }
    }, {
        tableName: 'RoomMembers',
        createdAt: 'join_time',
        updatedAt: false
    });

    RoomMember.associate = function(models) {
        // 移除可能导致循环依赖的关联，在需要的地方使用原始查询
    };

    return RoomMember;
};