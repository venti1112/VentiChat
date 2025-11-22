module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const SystemSetting = sequelize.define('SystemSetting', {
        settingId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true,
            field: 'setting_id'
        },
        messageRetentionDays: { 
            type: DataTypes.INTEGER, 
            defaultValue: 180,
            field: 'message_retention_days'
        },
        maxFileSize: { 
            type: DataTypes.INTEGER, 
            defaultValue: 10485760,
            field: 'max_file_size'
        },
        siteName: { 
            type: DataTypes.STRING(255), 
            defaultValue: 'VentiChat',
            field: 'site_name'
        },
        allowUserRegistration: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: true,
            field: 'allow_user_registration'
        },
        maxLoginAttempts: { 
            type: DataTypes.INTEGER, 
            defaultValue: 5,
            field: 'max_login_attempts'
        },
        maxRoomMembers: { 
            type: DataTypes.INTEGER, 
            defaultValue: 1000,
            field: 'max_room_members'
        },
        loginLockTime: {
            type: DataTypes.INTEGER,
            defaultValue: 30,
            field: 'login_lock_time'
        }
    }, {
        tableName: 'system_settings',
        timestamps: false
    });

    SystemSetting.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return SystemSetting;
};