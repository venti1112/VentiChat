module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Room = sequelize.define('Room', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        name: { type: DataTypes.STRING(100), allowNull: false },
        isPrivate: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_private' },
        requireApproval: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'require_approval' },
        allowImages: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'allow_images' },
        allowVideos: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'allow_videos' },
        allowFiles: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'allow_files' },
        retentionDays: { type: DataTypes.INTEGER, defaultValue: 180, field: 'retention_days' }
    }, {
        tableName: 'Rooms',
        createdAt: 'created_at',
        updatedAt: false
    });

    Room.associate = function(models) {
        // 定义聊天室与用户的多对多关系
        Room.belongsToMany(models.User, {
            through: models.RoomMember,
            foreignKey: 'room_id',
            otherKey: 'user_id',
            as: 'Participants'
        });
        
        // 定义聊天室创建者关系
        Room.belongsTo(models.User, {
            foreignKey: 'creator_id',
            as: 'Creator'
        });
    };

    return Room;
};