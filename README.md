# VentiChat

一个基于 Node.js 和 Socket.IO 构建的实时聊天应用程序。

> ⚠️ **重要提示**: 该项目仍在测试当中，请不要在生产环境中使用。

## 功能特性

- 实时聊天：通过 WebSocket 实现消息即时收发
- 聊天室管理：支持创建公开/私有聊天室，成员加入与退出
- 用户系统：注册、登录、JWT 认证、密码加密（bcrypt）、个人资料编辑
- 消息类型：支持文本、图片、视频、文件上传与展示
- 权限控制：基于角色的访问控制（管理员/普通用户）
- 安全机制：JWT 身份验证、IP 封禁中间件、真实 IP 解析
- 消息历史与在线状态：保留历史记录并显示用户在线状态

## 技术栈

- 后端：Node.js, Express.js, Socket.IO
- 数据库：MySQL (Sequelize ORM)
- 前端：HTML/CSS/JavaScript, Bootstrap 5
- 其他：JWT, bcrypt, multer, dotenv, express-rate-limit, node-cron

## 快速开始

### 环境要求
- Node.js 20 及以上版本
- MySQL 8.0 及以上版本
- Redis 2.8 及以上版本

### 安装步骤

1. 安装并配置环境

1. 下载源码包并解压

2. 安装依赖：
   ```bash
   npm install
   ```

4. 启动应用：
   ```bash
   npm start
   ```
   首次启动时，系统会自动运行初始化脚本，请根据提示输入信息（输入的 MySQL 账号必须要有创建数据库的权限）

5. 浏览器访问 `http://localhost:[端口号]`（默认端口在初始化时配置）

### 想要更好的性能?

程序使用群组模式运行且自带反向代理负载均衡模块，启动时会自动启动并进行反向代理负载均衡。

但是如果想要更好的性能，可以自行使用 Nginx 之类的反向代理负载均衡服务，具体每个为工作进程的端口号为设置端口+工作进程编号，如设置端口为3011，工作进程编号为6，则端口号为3017，以此类推。还可以把静态资源也用 Nginx 代理，后端只处理/api路径

## 目录结构

- `app.js`: 主应用文件
- `cluster.js`: 集群控制器
- `config/`: 配置文件目录
- `controllers/`: 控制器逻辑
- `middleware/`: 自定义中间件
- `models/`: 数据模型
- `public/`: 静态资源文件
- `routes/`: 路由配置
- `scripts/`: 脚本文件
- `utils/`: 工具函数

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

## 数据库结构说明

### 表结构总览

#### 1. users 表 - 用户信息表
存储系统用户基本信息和个性化设置

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| user_id | INT | PRIMARY KEY, AUTO_INCREMENT | 用户的唯一标识符，系统自动生成 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户登录名，全系统唯一不可重复 |
| nickname | VARCHAR(50) | NOT NULL | 用户在系统中显示的昵称 |
| password_hash | VARCHAR(255) | NOT NULL | 使用BCrypt算法加密后的密码 |
| avatar_url | VARCHAR(255) | DEFAULT '/default-avatar.png' | 用户头像图片的存储路径，默认使用系统默认头像 |
| background_url | VARCHAR(255) | DEFAULT '/wp.jpg' | 用户自定义背景图片的存储路径，默认使用系统默认背景 |
| theme_color | VARCHAR(7) | DEFAULT '#4cd8b8' | 用户自定义主题色的十六进制颜色代码，默认使用青绿色 |
| is_admin | BOOLEAN | DEFAULT false | 用户是否为系统管理员：true-是管理员，false-普通用户 |
| status | ENUM('active','banned') | DEFAULT 'active' | 用户账号状态：active-正常，banned-封禁 |
| login_attempts | INT | DEFAULT 0 | 用户连续登录失败次数，用于登录安全控制 |
| last_login_attempt | TIMESTAMP |  | 最后一次登录尝试时间 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 用户账号的创建时间，系统自动记录 |

#### 2. rooms 表 - 聊天室信息表
存储聊天室的基本信息和配置设置

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| room_id | INT | PRIMARY KEY, AUTO_INCREMENT | 聊天室的唯一标识符，系统自动生成 |
| name | VARCHAR(100) | NOT NULL | 聊天室的显示名称 |
| creator_id | INT | NOT NULL | 创建此聊天室的用户ID |
| is_private | BOOLEAN | DEFAULT false | 是否为私密聊天室：true-私密，false-公开 |
| require_approval | BOOLEAN | DEFAULT true | 加入聊天室是否需要审批：true-需要，false-不需要 |
| allow_images | BOOLEAN | DEFAULT true | 是否允许在聊天室发送图片 |
| allow_videos | BOOLEAN | DEFAULT true | 是否允许在聊天室发送视频 |
| allow_files | BOOLEAN | DEFAULT true | 是否允许在聊天室发送文件 |
| allow_audio | BOOLEAN | DEFAULT true | 是否允许在聊天室发送音频 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 聊天室的创建时间，系统自动记录 |

#### 3. room_members 表 - 聊天室成员表
存储用户与聊天室之间的关联关系和成员权限

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| user_id | INT | PRIMARY KEY | 用户ID，与room_id共同构成复合主键 |
| room_id | INT | PRIMARY KEY | 聊天室ID，与user_id共同构成复合主键 |
| is_moderator | BOOLEAN | DEFAULT false | 是否为聊天室管理员：true-是管理员，false-普通成员 |
| note | VARCHAR(100) |  | 成员备注信息，可由管理员设置 |
| last_read_message_id | INT | DEFAULT 0 | 用户最后阅读的消息ID，用于计算未读消息数量 |
| join_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 用户加入聊天室的时间，系统自动记录 |

#### 4. messages 表 - 消息记录表
存储所有聊天消息的内容和元数据

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| message_id | INT | PRIMARY KEY, AUTO_INCREMENT | 消息的唯一标识符，系统自动生成 |
| room_id | INT | NOT NULL | 消息所属的聊天室ID |
| user_id | INT | NOT NULL | 发送消息的用户ID |
| content | TEXT |  | 消息的文本内容，支持长文本 |
| type | ENUM('text','image','video','file') | DEFAULT 'text' | 消息类型：text-文本，image-图片，video-视频，file-文件 |
| file_url | VARCHAR(255) |  | 附件的存储路径，非文本消息时使用 |
| file_size | INT | DEFAULT 0 | 附件文件大小（字节），用于文件大小统计 |
| is_deleted | BOOLEAN | DEFAULT false | 消息是否已被撤回：true-已撤回，false-正常 |
| sent_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 消息发送时间，系统自动记录 |

#### 5. join_requests 表 - 加入申请表
存储用户申请加入聊天室的记录和审批状态

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| request_id | INT | PRIMARY KEY, AUTO_INCREMENT | 加入申请的唯一标识符，系统自动生成 |
| status | ENUM('pending','approved','rejected') | DEFAULT 'pending' | 申请状态：pending-待处理，approved-已批准，rejected-已拒绝 |
| request_message | VARCHAR(255) |  | 用户提交申请时的附言 |
| user_id | INT | NOT NULL | 提交申请的用户ID |
| room_id | INT | NOT NULL | 申请加入的聊天室ID |
| request_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 申请提交时间，系统自动记录 |

#### 6. system_settings 表 - 系统设置表
存储系统全局配置参数

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| setting_id | INT | PRIMARY KEY, AUTO_INCREMENT | 系统设置项的唯一标识符（永远是1） |
| message_retention_days | INT | DEFAULT 180 | 全局消息保留天数，超过天数的消息自动清理 |
| max_file_size | INT | DEFAULT 10485760 | 上传文件最大大小（字节），默认10MB（系统全局设置，实际限制根据不同文件类型有所不同） |
| site_name | VARCHAR(255) | DEFAULT VentiChat | 网站显示名称 |
| allow_user_registration | BOOLEAN | DEFAULT true | 是否允许新用户注册：true-允许，false-禁止 |
| max_login_attempts | INT | DEFAULT 5 | 最大登录尝试次数，超过次数会暂时封禁IP |
| login_lock_time | INT | DEFAULT 30 | IP登录失败锁定时间（分钟），超过时间后自动解锁 |
| max_room_members | INT | DEFAULT 1000 | 单个聊天室最大成员数量 |

### 文件上传限制说明

系统对不同类型的文件上传设置了不同的大小限制：
- 头像图片：最大5MB
- 背景图片：最大10MB
- 聊天消息中的图片/视频/文件：受[max_file_size](file:///c%3A/Users/Venti/Documents/Project/VentiChat/models/systemSetting.js#L22-L26)系统设置限制（默认10MB）

### 权限层级说明

#### 1. 系统管理员 (users.is_admin)
- **权限范围**：整个系统
- **管理权限**：
  - 管理所有用户账号
  - 管理所有聊天室
  - 配置系统全局设置
  - 查看系统日志和统计数据

#### 2. 聊天室创建者 (rooms.creator_id)
- **权限范围**：创建的聊天室
- **管理权限**：
  - 管理聊天室成员
  - 审批加入申请
  - 删除聊天室消息
  - 设置聊天室规则
  - 解散聊天室
  - 任命和撤销聊天室管理员

#### 3. 聊天室管理员 (room_members.is_moderator)
- **权限范围**：单个聊天室
- **管理权限**：
  - 管理聊天室成员
  - 审批加入申请
  - 删除聊天室消息
  - 设置聊天室规则

#### 4. 普通用户
- **权限范围**：个人账号和加入的聊天室
- **基本权限**：
  - 修改个人信息
  - 发送消息
  - 申请加入聊天室
  - 创建新聊天室

*注：所有上级权限都拥有下级的所有权限

## 多进程架构说明

### Cluster模式
系统采用Node.js的Cluster模块实现多进程架构，以充分利用多核CPU性能并提高系统稳定性。

#### 工作原理
1. 主进程负责管理工作进程
2. 工作进程实际处理用户请求
3. 每个工作进程独立运行，拥有自己的内存空间
4. 工作进程之间通过主进程进行通信

#### 配置参数
- `workerCount`: 工作进程数量（0表示使用CPU核心数）

#### 注意事项
1. 每个工作进程都维护独立的数据库连接池
2. WebSocket连接分布在不同的工作进程中
3. 日志记录包含了进程ID以便区分不同工作进程的日志

## Redis缓存说明

为了支持跨进程的WebSocket会话管理、用户认证和IP封禁，系统引入了Redis作为分布式缓存。

### Redis配置
- `redis.host`: Redis服务器主机地址
- `redis.port`: Redis服务器端口
- `redis.password`: Redis访问密码（可选）

### Redis数据结构

1. 用户Socket映射哈希表 (`user:{userId}`)：
   - 存储用户在各个工作进程中的Socket连接信息
   - Key: `user:{userId}`
   - Field: `{workerId}`
   - Value: `{socketId, timestamp}`

2. Socket用户映射 (`socket:{socketId}`)：
   - 快速查找Socket关联的用户
   - Key: `socket:{socketId}`
   - Value: `{userId}`

3. 用户Token信息 (`token:{token}`)：
   - 存储Token及其关联的用户信息和过期时间
   - Key: `token:{tokenString}`
   - Value: `{userId, expiresAt}`

4. 用户Token集合 (`user_tokens:{userId}`)：
   - 存储用户所有的有效Token
   - Key: `user_tokens:{userId}`
   - Type: Set

5. 封禁IP信息 (`banned_ip:{ip}`)：
   - 存储被封禁的IP地址及其相关信息
   - Key: `banned_ip:{ip}`
   - Value: `{banTime, unbanTime, failedAttempts}`

### 使用场景
1. WebSocket会话管理：跨进程识别用户连接
2. 实时消息推送：向用户的所有连接广播消息
3. 用户状态同步：在多个工作进程间同步用户状态
4. Token管理：跨进程验证用户身份
5. IP封禁：在所有工作进程中统一IP封禁策略

## 系统维护任务

系统使用node-cron实现定时任务调度，定期执行维护任务：

1. **消息清理**：根据message_retention_days设置（默认180天）自动删除过期消息
2. **临时文件清理**：定期清理上传过程中产生的临时文件
3. **Token清理**：定期清理过期的用户认证Token
4. **其他清理任务**：清理不再需要的系统数据

## API 接口

### 认证相关接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/verify` - 验证令牌有效性

### 用户相关接口

- `GET /api/users/profile/:userId` - 获取用户资料
- `PUT /api/users/profile` - 更新个人资料
- `GET /api/users/search?keyword=xxx` - 搜索用户
- `GET /api/users/preferences` - 获取用户偏好设置
- `PUT /api/users/preferences` - 更新用户偏好设置
- `POST /api/users/upload-background` - 上传聊天背景图
- `POST /api/users/reset-background` - 重置聊天背景图

### 聊天室相关接口

- `GET /api/rooms` - 获取用户加入的聊天室列表
- `POST /api/rooms` - 创建聊天室
- `POST /api/rooms/private` - 创建私聊
- `GET /api/rooms/search?keyword=xxx` - 搜索公开聊天室
- `GET /api/rooms/:id` - 获取聊天室信息
- `GET /api/rooms/:roomId/members` - 获取聊天室成员列表
- `DELETE /api/rooms/:roomId/members/:userId` - 踢出聊天室成员
- `POST /api/rooms/:id/join-request` - 发送加入聊天室请求
- `GET /api/rooms/:id/pending-requests` - 获取待处理的加入请求
- `POST /api/rooms/:id/approve-join-request` - 批准/拒绝加入请求
- `PUT /api/rooms/:id/settings` - 更新聊天室设置
- `PUT /api/rooms/:roomId/members/:userId/role` - 设置成员角色

### 消息相关接口

- `GET /api/messages/:roomId` - 获取聊天室消息
- `GET /api/messages/history/:roomId` - 获取聊天室历史消息
- `POST /api/messages` - 发送消息
- `PUT /api/messages/:messageId/retract` - 撤回消息

### 文件上传相关接口

- `POST /api/messages/image` - 上传图片
- `POST /api/messages/video` - 上传视频
- `POST /api/messages/file` - 上传文件
- `POST /api/messages/chunked/initiate` - 初始化分块上传
- `POST /api/messages/chunked/upload` - 上传文件块
- `POST /api/messages/chunked/complete` - 完成分块上传

### 管理员接口

需要管理员权限才能访问以下接口:

- `GET /api/admin/users` - 获取所有用户列表
- `POST /api/admin/users` - 创建用户
- `PUT /api/admin/users/:userId` - 更新用户信息
- `DELETE /api/admin/users/:userId` - 删除用户
- `PUT /api/admin/users/:userId/status` - 更新用户状态
- `GET /api/admin/rooms` - 获取所有聊天室列表
- `GET /api/admin/rooms/:id` - 获取聊天室详情
- `GET /api/admin/rooms/:id/members` - 获取聊天室成员列表
- `DELETE /api/admin/rooms/:id` - 删除聊天室
- `GET /api/admin/config` - 获取系统配置
- `PUT /api/admin/config` - 更新系统配置

### 自定义配置

配置文件位于 [config/config.json](file:///C:/Users/Venti/Documents/Project/VentiChat/config/config.json)，可以修改以下参数：
- 数据库连接信息
- 服务器端口
- 加密密钥
- 基础 URL

## 开发指南

### 添加新功能

1. 在 [models/](models) 目录下创建对应的数据模型
2. 在 [controllers/](controllers) 目录下实现业务逻辑
3. 在 [routes/](routes) 目录下添加 API 路由
4. 如果需要，在 [middleware/](middleware) 目录下添加中间件

### 自定义配置

配置文件位于 config/config.json，可以修改以下参数：
- 数据库连接信息
- 服务器端口
- 加密密钥
- 基础 URL

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

本项目采用 AGPL-3.0 许可证发布。详情请参见 [LICENSE](LICENSE) 文件。
