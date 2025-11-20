module.exports = (sequelize) => {
    // 直接使用sequelize.DataTypes而不是解构
    const DataTypes = sequelize.constructor.DataTypes;
    
    const User = sequelize.define('User', {
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
        // 移除可能导致循环依赖的关联，在需要的地方使用原始查询
    };

    return User;
};