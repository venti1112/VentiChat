// models/joinRequest.js
module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const JoinRequest = sequelize.define('JoinRequest', {
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
        JoinRequest.belongsTo(models.User, { foreignKey: 'userId' });
        JoinRequest.belongsTo(models.Room, { foreignKey: 'roomId' });
    };

    return JoinRequest;
};