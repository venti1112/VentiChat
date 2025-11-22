module.exports = (sequelize) => {
  const DataTypes = sequelize.constructor.DataTypes;
  
  const Token = sequelize.define('Token', {
    tokenStr: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      field: 'token_str'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
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
    // 根据新要求，移除所有外键关联
  };

  return Token;
};