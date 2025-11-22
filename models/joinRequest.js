module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const JoinRequest = sequelize.define('JoinRequest', {
        requestId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true,
            field: 'request_id'
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending',
            field: 'status'
        },
        requestMessage: { 
            type: DataTypes.STRING(255), 
            field: 'request_message' 
        },
        userId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'user_id'
        },
        roomId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'room_id'
        },
        requestTime: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'request_time'
        }
    }, {
        tableName: 'join_requests',
        timestamps: false
    });

    JoinRequest.associate = function(models) {
        // 根据新要求，移除所有外键关联
    };

    return JoinRequest;
};