const fs = require('fs');
const path = require('path');

module.exports = (sequelize) => {
    // 自动加载所有模型文件（除了index.js本身）
    const models = {};
    
    // 获取当前目录下所有.js文件（除了index.js）
    const modelFiles = fs.readdirSync(__dirname)
        .filter(file => file !== 'index.js' && file.endsWith('.js'));
    
    // 加载每个模型文件
    modelFiles.forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize);
        models[model.name] = model;
    });
    
    // 设置模型关联
    Object.keys(models).forEach(modelName => {
        if (models[modelName].associate) {
            models[modelName].associate(models);
        }
    });
    
    return models;
};

const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, '..', 'config', 'config.json'));
const { logDatabaseQuery } = require('../utils/logger'); // 引入日志函数

let sequelize;
// 直接使用db配置，因为config.json中没有分环境配置
const dbConfig = config.db;
sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: 'mysql',
  logging: logDatabaseQuery // 使用自定义日志函数记录数据库查询
});

const db = {};

// 读取当前目录下的所有模型文件
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize);
    db[model.name] = model;
  });

// 不再自动设置模型关联，避免循环依赖
// 手动在 app.js 中设置关联关系

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;