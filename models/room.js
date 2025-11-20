module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Room = sequelize.define('Room', {
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
        // 移除可能导致循环依赖的关联，在需要的地方使用原始查询
    };

    return Room;
};