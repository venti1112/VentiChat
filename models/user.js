module.exports = (sequelize) => {
    // 直接使用sequelize.DataTypes而不是解构
    const DataTypes = sequelize.constructor.DataTypes;
    
    const User = sequelize.define('User', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        username: { type: DataTypes.STRING(50), unique: true, allowNull: false },
        nickname: { type: DataTypes.STRING(50), allowNull: false },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
        avatarUrl: { type: DataTypes.STRING(255), field: 'avatar_url' },
        status: { type: DataTypes.ENUM('active', 'banned'), defaultValue: 'active' }
    }, {
        tableName: 'Users',
        createdAt: 'created_at',
        updatedAt: false
    });

    User.associate = function(models) {
        // 定义用户与聊天室的多对多关系
        User.belongsToMany(models.Room, {
            through: models.RoomMember,
            foreignKey: 'user_id',
            otherKey: 'room_id',
            as: 'JoinedRooms'
        });
    };

    return User;
};