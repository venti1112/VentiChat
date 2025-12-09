module.exports = (sequelize) => {
    const DataTypes = sequelize.constructor.DataTypes;
    
    const Room = sequelize.define('Room', {
        roomId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true,
            field: 'room_id'
        },
        name: { 
            type: DataTypes.STRING(100), 
            allowNull: false,
            field: 'name'
        },
        creatorId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            field: 'creator_id' 
        },
        isPrivate: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: false, 
            field: 'is_private' 
        },
        requireApproval: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: true, 
            field: 'require_approval' 
        },
        allowImages: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: true, 
            field: 'allow_images' 
        },
        allowVideos: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: true, 
            field: 'allow_videos' 
        },
        allowFiles: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: true, 
            field: 'allow_files' 
        },
        allowAudio: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'allow_audio'
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }
    }, {
        tableName: 'rooms',
        timestamps: false
    });

    Room.associate = function(models) {
        // 根据新要求，移除所有外键关联
        Room.belongsTo(models.User, {
            foreignKey: 'creator_id',
            as: 'creator'
        });
    };

    return Room;
};