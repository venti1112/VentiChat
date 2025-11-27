# VentiChat

一个基于 Node.js 和 Socket.IO 构建的实时聊天应用程序。

> ⚠️ **重要提示**: 该项目仍在测试当中，请不要在生产环境中使用。

## 功能特性

- 实时聊天：通过 WebSocket 实现实时消息传递
- 聊天室：支持创建公共和私人聊天室
- 用户系统：注册、登录和个人资料管理
- 消息类型：支持文本、图片、视频和文件消息
- 权限控制：基于角色的访问控制（管理员、普通用户）
- 安全性：JWT 认证和密码加密存储
- 响应式设计：适配桌面和移动端设备

## 技术栈

### 后端
- Node.js
- Express.js - Web 应用框架
- Socket.IO - 实时通信
- MySQL - 数据库存储
- Sequelize - ORM 框架
- JWT - 用户认证

### 前端
- HTML/CSS/JavaScript
- Bootstrap 5 - UI 框架
- Socket.IO Client - WebSocket 客户端

## 快速开始

### 环境要求
- Node.js 24
- MySQL 9.5

### 安装步骤

1. 在下载源码包并解压

2. 安装依赖：
   ```bash
   npm install
   ```

3. 初始化项目：
   ```bash
   npm run init
   ```
   运行此命令将引导您完成以下配置：
   - 数据库连接设置
   - 管理员账户创建
   - 服务器端口配置

4. 启动应用：
   ```bash
   npm start
   ```

5. 在浏览器中访问 `http://localhost:3011`（默认端口）

## 项目结构

```
VentiChat/
├── config/              # 配置文件
├── controllers/         # 控制器逻辑
├── middleware/         # 中间件
├── models/             # 数据模型
├── public/             # 静态资源文件
│   ├── css/            # 样式文件
│   └── js/             # JavaScript 文件
├── routes/             # 路由定义
├── scripts/            # 脚本文件
└── utils/              # 工具函数
```

## 主要功能模块

### 用户管理
- 用户注册与登录
- 个人资料编辑
- 头像上传
- 密码修改

### 聊天室管理
- 创建聊天室（公开/私有）
- 加入/退出聊天室
- 聊天室成员管理
- 聊天室设置调整

### 消息系统
- 文本消息发送与接收
- 图片、视频和文件分享
- 消息历史记录
- 实时在线状态显示

## 开发指南

### 添加新功能

1. 在 [models/](file:///c%3A/Users/Venti/Documents/Project/VentiChat/models) 目录下创建对应的数据模型
2. 在 [controllers/](file:///c%3A/Users/Venti/Documents/Project/VentiChat/controllers) 目录下实现业务逻辑
3. 在 [routes/](file:///c%3A/Users/Venti/Documents/Project/VentiChat/routes) 目录下添加 API 路由
4. 如果需要，在 [middleware/](file:///c%3A/Users/Venti/Documents/Project/VentiChat/middleware) 目录下添加中间件

### 自定义配置

配置文件位于 [config/config.json](file:///c%3A/Users/Venti/Documents/Project/VentiChat/config/config.json)，可以修改以下参数：
- 数据库连接信息
- 服务器端口
- 加密密钥
- 基础 URL

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

本项目采用 AGPL-3.0 许可证发布。详情请参见 [LICENSE](LICENSE) 文件。
