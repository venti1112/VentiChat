module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Room = sequelize.define('Room', {
        name: { type: DataTypes.STRING(100), allowNull: false },
        isPrivate: { type: DataTypes.BOOLEAN, defaultValue: false },
        requireApproval: { type: DataTypes.BOOLEAN, defaultValue: true },
        allowImages: { type: DataTypes.BOOLEAN, defaultValue: true },
        allowVideos: { type: DataTypes.BOOLEAN, defaultValue: true },
        allowFiles: { type: DataTypes.BOOLEAN, defaultValue: true },
        retentionDays: { type: DataTypes.INTEGER, defaultValue: 180 }
    }, {
        tableName: 'Rooms',
        createdAt: 'created_at',
        updatedAt: false
    });

    Room.associate = function(models) {
        Room.belongsTo(models.User, { foreignKey: 'creatorId', as: 'Creator' });
        Room.belongsToMany(models.User, { through: models.RoomMember, as: 'Participants' });
    };

    return Room;
};