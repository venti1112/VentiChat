module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const RoomMember = sequelize.define('RoomMember', {
        isModerator: { type: DataTypes.BOOLEAN, defaultValue: false },
        note: { type: DataTypes.STRING(100) },
        lastReadMessageId: { type: DataTypes.INTEGER, defaultValue: 0 }
    }, {
        tableName: 'RoomMembers',
        createdAt: 'join_time',
        updatedAt: false
    });

    RoomMember.associate = function(models) {
        // 多对多关系的关联在User和Room模型中定义
    };

    return RoomMember;
};