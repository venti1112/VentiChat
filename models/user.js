module.exports = (sequelize) => {
    // 直接使用sequelize.DataTypes而不是解构
    const DataTypes = sequelize.constructor.DataTypes;
    
    const User = sequelize.define('User', {
        username: { type: DataTypes.STRING(50), unique: true, allowNull: false },
        nickname: { type: DataTypes.STRING(50), allowNull: false },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false },
        avatarUrl: { type: DataTypes.STRING(255) },
        status: { type: DataTypes.ENUM('active', 'banned'), defaultValue: 'active' }
    }, {
        tableName: 'Users',
        createdAt: 'created_at',
        updatedAt: false
    });

    User.associate = function(models) {
        User.hasMany(models.Room, { foreignKey: 'creatorId', as: 'CreatedRooms' });
        User.belongsToMany(models.Room, { through: models.RoomMember, as: 'JoinedRooms' });
    };

    return User;
};