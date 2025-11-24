# VentiChat

> **提示：本项目还在开发中，请不要使用！！！**

一个基于 Rust 的聊天服务器，提供实时消息通信功能。

## 功能特性

- 用户注册/登录（JWT 认证）
- 聊天室创建与管理
- 实时消息发送与接收
- 文件上传管理
- 管理员系统与权限控制
- IP 封禁机制
- 定时任务清理过期数据
- 数据持久化（MySQL）

## 技术栈

- 后端：Rust + Axum
- 实时通信：WebSocket
- 数据库：MySQL
- 前端：Bootstrap 5 + HTML/CSS/JavaScript

## 快速开始

### 环境要求

- Rust 1.70+
- MySQL 5.7+

### 安装步骤

1. 克隆项目：
   ```bash
   git clone <repository-url>
   cd VentiChat
   ```

2. 配置环境变量：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件填写正确的配置
   ```

3. 运行数据库迁移：
   ```bash
   # 确保 MySQL 服务正在运行
   ```

4. 启动应用：
   ```bash
   cargo run
   ```

## 项目结构

```
src/
├── main.rs         # 应用入口
├── lib.rs          # 模块声明
├── config.rs       # 配置处理
├── db.rs           # 数据库连接
├── models.rs       # 数据模型
└── init.rs         # 初始化逻辑
```

## API 端点

- `GET /` - 主页
- `GET /health` - 健康检查

---

*更多文档将在后续完善*