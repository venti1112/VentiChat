// models/joinRequest.js
module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const JoinRequest = sequelize.define('JoinRequest', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        message: { type: DataTypes.STRING(255), field: 'message' }
    }, {
        tableName: 'JoinRequests',
        createdAt: 'request_time',
        updatedAt: false
    });

    JoinRequest.associate = function(models) {
        // 移除可能导致循环依赖的关联，在需要的地方使用原始查询
    };

    return JoinRequest;
};