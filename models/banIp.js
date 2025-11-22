module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const BanIp = sequelize.define('BanIp', {
        ip: { 
            type: DataTypes.STRING(45), 
            primaryKey: true,
            field: 'ip'
        },
        banTime: { 
            type: DataTypes.DATE, 
            allowNull: false,
            field: 'ban_time'
        },
        unbanTime: { 
            type: DataTypes.DATE, 
            allowNull: false,
            field: 'unban_time'
        },
        failedAttempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'failed_attempts'
        }
    }, {
        tableName: 'ban_ip',
        timestamps: false
    });

    BanIp.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return BanIp;
};