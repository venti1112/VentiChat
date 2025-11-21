module.exports = (sequelize) => {
  // 直接使用sequelize.DataTypes而不是解构
  const DataTypes = sequelize.constructor.DataTypes;
  
  const Token = sequelize.define('Token', {
    token: {
      type: DataTypes.STRING,
      primaryKey: true,
      field: 'token_str'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'User',
        key: 'id'
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    }
  }, {
    tableName: 'tokens',
    timestamps: false
  });

  Token.associate = function(models) {
    Token.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Token;
};