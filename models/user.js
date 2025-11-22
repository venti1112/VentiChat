module.exports = (sequelize) => {
    // 直接使用sequelize.DataTypes而不是解构
    const DataTypes = sequelize.constructor.DataTypes;
    
    const User = sequelize.define('User', {
        userId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true,
            field: 'user_id'
        },
        username: { 
            type: DataTypes.STRING(50), 
            unique: true, 
            allowNull: false,
            field: 'username'
        },
        nickname: { 
            type: DataTypes.STRING(50), 
            allowNull: false,
            field: 'nickname'
        },
        passwordHash: { 
            type: DataTypes.STRING(255), 
            allowNull: false, 
            field: 'password_hash' 
        },
        avatarUrl: { 
            type: DataTypes.STRING(255), 
            defaultValue: '/default-avatar.png',
            field: 'avatar_url' 
        },
        backgroundUrl: {
            type: DataTypes.STRING(255),
            defaultValue: '/wp.jpg',
            field: 'background_url'
        },
        themeColor: {
            type: DataTypes.STRING(7),
            defaultValue: '#4cd8b8',
            field: 'theme_color'
        },
        isAdmin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_admin'
        },
        status: { 
            type: DataTypes.ENUM('active', 'banned'), 
            defaultValue: 'active',
            field: 'status'
        },
        loginAttempts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'login_attempts'
        },
        lastLoginAttempt: {
            type: DataTypes.DATE,
            field: 'last_login_attempt'
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }
    }, {
        tableName: 'users',
        timestamps: false
    });

    User.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return User;
};