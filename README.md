> ⚠️ **重要提示**: 该项目未开发完毕，请不要使用。
> 
# VentiChat

VentiChat 是一个开源的实时聊天应用程序，采用全栈设计，主打部署简单快捷，适合团队或个人使用。

## 功能介绍
- 用户注册：使用用户名注册，邮箱、手机号，可选邮箱验证激活
- 用户登录：支持用户名密码登录、邮箱密码登录、手机号密码登录、扫码登录、WebAuthn 登录、邮箱验证码登录，支持双因素认证，支持登录时推送邮件提醒
- 用户信息：用户可以设置昵称、性别、生日、个人简介
- 用户个性化：用户可以设置主题颜色、背景图片、消息提醒方式、新消息提示音效
- 好友系统：用户可以发送添加好友请求、删除、拉黑、查看好友列表
- 群聊系统：用户可以创建、加入、退出、查看群聊列表、查看群聊成员列表
- 群聊申请：用户可以申请加入某个群聊，可选群管理员审核功能
- 群聊管理：管理员可以管理某个群聊，包括修改群聊名称、群主、群成员、群公告、禁言、踢人、拉人等
- 消息系统：用户可以查看历史消息记录、发送私聊消息、发送群聊消息、发送文件消息
- 文件消息查看：图片、视频、音频可在线查看播放，其他文件需下载后自行查看
- 实时消息：消息实时推送、支持桌面消息推送、邮箱消息推送
- 违禁词检查：确保聊天环境中没有不良信息，可自定义违禁词库
- 支持服务器集群：应用支持多服务器集群，实现高并发、高可用性
- 安全性：应用采用 JWT 认证，用户信息、Token 加密传输，安全可靠
- IP 封禁：可配置 IP 封禁，单个 IP 登录失败次数过多时，IP 自动被封禁，并在一段时间后自动解封
- 速率限制：可配置每几秒最多发送多少消息
- 文件分片上传：文件分片上传，提高上传成功率
- 聊天数据定时清理：可配置定时清理聊天数据，减少数据占用空间

## 环境要求
- MySQL 8.0 及以上版本
- Redis 5.0 及以上版本

## 启动服务器

首次启动时将会进入网页初始化向导，请访问 `http://localhost:3012` 进行初始化配置

初始化完成后，访问 `http://localhost:端口号` 使用应用（端口号在初始化配置中设置）

## 技术栈

### 后端技术

- Go 1.25+: 核心编程语言
- Gin: 高性能 HTTP Web 框架
- GORM: ORM 库，简化数据库操作
- MySQL: 主数据库，存储用户、消息等持久化数据
- Redis: 缓存和实时消息传递，支持分布式部署
- Gorilla WebSocket: 实现实时双向通信
- JWT: 用户身份验证和授权
- bcrypt: 密码加密算法
- Viper: 配置管理工具
- Zap: 高性能日志库

### 前端技术

- Bootstrap 5: UI 库
- Bootstrap Icons: 图标库
- HTML/CSS/JavaScript: 原生HTML/CSS/JavaScript

## 项目结构

```
ventichat/
├── config/              # 配置文件目录
│   └── config.yaml      # 配置文件
├── internal/            # 后端核心业务逻辑代码
│   ├── app/             # 应用程序初始化和路由配置
│   ├── handler/         # HTTP 请求处理器
│   ├── model/           # 数据库模型定义
│   ├── service/         # 业务逻辑层
│   ├── repository/      # 数据访问层
│   ├── middleware/      # 中间件
│   ├── utils/           # 工具函数
|   └── setup/           # 初始化脚本
├── web/                 # 前端静态资源
├── main.go              # 程序入口点
├── go.mod               # Go 模块定义文件
├── go.sum               # Go 模块校验和文件
└── README.md            # 项目说明文件
```

## 数据库结构

### 用户表 (users)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 用户唯一标识 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| mobile | VARCHAR(20) | UNIQUE | 手机号 |
| email | VARCHAR(255) | UNIQUE | 邮箱地址 |
| nickname | VARCHAR(100) | NOT NULL | 昵称 |
| password_hash | VARCHAR(255) |  | 使用 bcrypt 加密后的密码 |
| is_admin | BOOLEAN | DEFAULT false | 是否为管理员 |
| is_freepass | BOOLEAN | DEFAULT false | 是否无密码账户（必须使用其他方式登录） |
| email_verified | BOOLEAN | DEFAULT false | 邮箱是否已验证 |
| is_totp_enabled | BOOLEAN | DEFAULT false | 是否启用双因素认证 |
| totp_secret | VARCHAR(255) |  | 双因素认证密钥 |
| introduction | TEXT |  | 个人简介 |
| is_banned | BOOLEAN | DEFAULT false | 用户是否被封禁 |
| banned_at | TIMESTAMP |  | 被封禁时间 |
| banned_reason | TEXT |  | 被封禁原因 |
| banned_type | ENUM('login','mute','permanent') |  | 封禁类型（完全禁止登录、仅禁言、永久封禁不能登录） |
| banned_by | BIGINT UNSIGNED | FOREIGN KEY REFERENCES users(id) | 封禁操作员的ID |
| banned_texpires | TIMESTAMP |  | 封禁到期时间 |
| avatar_url | VARCHAR(255) | DEFAULT '/default/avatar.png' | 用户头像URL |
| theme_color | VARCHAR(10) | DEFAULT '#4cd8b8' | 自定义主题颜色 |
| background_url | VARCHAR(255) | DEFAULT '/default/background.png' | 自定义背景图片URL |
| sound_url | VARCHAR(255) | DEFAULT '/default/sound.mp3' | 自定义新消息提示音URL |
| language | VARCHAR(10) | DEFAULT 'zh-CN' | 语言设置 |
| is_email_notification | BOOLEAN | DEFAULT false | 是否开启邮件通知 |
| is_desktop_notification | BOOLEAN | DEFAULT false | 是否开启桌面通知 |
| is_email_remind | BOOLEAN | DEFAULT true | 是否开启登录时邮箱提醒 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 好友关系表 (friends)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 关系ID |
| user_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 用户ID |
| friend_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 好友ID |
| status | ENUM('active','block') | DEFAULT 'active' | 好友状态 (正常、拉黑) |
| unread | INT | NOT NULL, DEFAULT 0 | 未读消息数量 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 好友申请表 (friend_requests)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 申请ID |
| requester_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 申请者ID |
| target_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 被申请者ID |
| message | TEXT |  | 申请消息 |
| status | ENUM('pending','accepted','rejected') |  | 申请状态 (待处理、已接受、已拒绝) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间（申请时间） |
| handled_at | TIMESTAMP |  | 处理时间 |

### 群聊表 (groups)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 群聊ID |
| name | VARCHAR(100) | NOT NULL | 群聊名称 |
| avatar_url | VARCHAR(255) | DEFAULT '/default/group.png' | 群聊头像URL |
| owner_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 群主ID |
| description | TEXT |  | 群聊描述 |
| announcement | TEXT |  | 群公告 |
| need_approval | BOOLEAN | DEFAULT true | 是否需要审批 |
| is_private | BOOLEAN | DEFAULT false | 是否是私有群聊 |
| is_mute | BOOLEAN | DEFAULT false | 群聊是否被禁言 |
| mute_at | TIMESTAMP |  | 禁言时间 |
| mute_reason | TEXT |  | 禁言原因 |
| mute_permanent | BOOLEAN | DEFAULT false | 是否永久禁言 |
| mute_by | BIGINT UNSIGNED | FOREIGN KEY REFERENCES users(id) | 禁言操作员的ID |
| mute_texpires | TIMESTAMP |  | 禁言到期时间 |
| is_banned | BOOLEAN | DEFAULT false | 群聊是否被封禁 |
| banned_at | TIMESTAMP |  | 被封禁时间 |
| banned_reason | TEXT |  | 被封禁原因 |
| banned_permanent | BOOLEAN | DEFAULT false | 是否永久封禁 |
| banned_by | BIGINT UNSIGNED | FOREIGN KEY REFERENCES users(id) | 封禁操作员的ID |
| banned_texpires | TIMESTAMP |  | 封禁到期时间 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| block_users | JSON |  | 被拉黑的用户ID列表（JSON格式） |
| background_url | VARCHAR(255) | DEFAULT '/default/background-group.png' | 群聊主页背景图片URL |

### 群聊成员表 (group_members)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 成员关系ID |
| group_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES groups(id) | 群聊ID |
| user_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 用户ID |
| role | ENUM('member','admin','owner') | DEFAULT 'member' | 成员角色 (成员、管理员、群主) |
| unread | INT | NOT NULL, DEFAULT 0 | 未读消息数量 |
| is_mute | BOOLEAN | DEFAULT false | 成员是否被禁言 |
| mute_at | TIMESTAMP |  | 禁言时间 |
| mute_reason | TEXT |  | 禁言原因 |
| mute_permanent | BOOLEAN | DEFAULT false | 是否永久禁言 |
| mute_by | BIGINT UNSIGNED | FOREIGN KEY REFERENCES users(id) | 禁言操作员的ID |
| mute_texpires | TIMESTAMP |  | 禁言到期时间 |
| joined_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 加入时间 |

### 群聊申请表 (group_requests)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 申请ID |
| user_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 申请用户ID |
| group_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES groups(id) | 群聊ID |
| message | TEXT |  | 申请人消息 |
| status | ENUM('pending','accepted','rejected') | DEFAULT 'pending' | 申请状态 (待处理、已接受、已拒绝) |
| handled_by | BIGINT UNSIGNED | FOREIGN KEY REFERENCES users(id) | 处理人ID |
| handled_message | TEXT |  | 处理人消息 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| handled_at | TIMESTAMP |  | 处理时间 |

### 消息表 (messages)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 消息ID |
| sender_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 发送者ID |
| receiver_type | ENUM('user','group') | NOT NULL | 接收者类型 (用户、群聊) |
| receiver_id | BIGINT UNSIGNED | NOT NULL | 接收者ID (根据receiver_type区分是用户还是群聊) |
| message_type | ENUM('text','image','audio','video','file') | DEFAULT 'text' | 消息类型 (文本、图片、音频、视频、文件) |
| content | TEXT |  | 消息内容 |
| file_url | VARCHAR(255) |  | 文件URL (当消息类型为文件时) |
| file_name | VARCHAR(255) |  | 文件名 |
| file_size | BIGINT |  | 文件大小(字节) |
| sent_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 发送时间 |

### 违禁词表 (banned_words)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 违禁词ID |
| type | ENUM('all','group') | NOT NULL | 违禁词类型 (全局、特定群聊) |
| group_id | BIGINT UNSIGNED | FOREIGN KEY REFERENCES groups(id) | 特定群聊ID |
| word | TEXT | NOT NULL | 违禁词 |
| frequency | BIGINT UNSIGNED | DEFAULT 0 | 总违禁次数 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### WebAuthn 表 (webauthn)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 密钥ID |
| user_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 用户ID |
| name | VARCHAR(100) | NOT NULL | 密钥名称 |
| credential_id | VARCHAR(255) | NOT NULL | 密钥ID |
| public_key | VARCHAR(255) | NOT NULL | 公钥 |
| attestation_object | BLOB | NOT NULL | 认证对象 |
| sign_count | INT | NOT NULL | 签名计数器 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 登录日志表 (login_records)
| 字段名 | 类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | 登录记录ID |
| user_id | BIGINT UNSIGNED | NOT NULL, FOREIGN KEY REFERENCES users(id) | 用户ID |
| ip | VARCHAR(50) | NOT NULL | 登录IP |
| user_agent | VARCHAR(255) | NOT NULL | 登录设备信息 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 登录时间 |

## Redis

### Redis基本数据结构

1. 用户到 Socket 映射 (`user:{userId}:sockets`)：
   - 类型：Redis Set
   - 描述：存储该用户当前所有在线的 WebSocket 连接 ID
   - Key: `user:{userId}:sockets`
   - Value: `Set(socketId)`

2. Socket 到用户映射 (`socket:{socketId}`)：
   - 快速查找Socket关联的用户
   - Key: `socket:{socketId}`
   - Value: `{userId}`

3. 用户Token信息 (`token:{token}`)：
   - 存储Token及其关联的用户ID
   - Key: `token:{token}`
   - Value: `{userId}`
   - 过期时间在配置文件中配置

4. 封禁IP信息 (`banned_ip:{ip}`)：
   - 存储被封禁的IP地址及其相关信息
   - Key: `banned_ip:{ip}`
   - Value: `{banned_reason}`
   - 过期时间在配置文件中配置

5. 邮箱验证信息 (`email_verify:{emailVerifyCode}`)：
   - 存储用户注册时的邮箱验证ID及相关信息
   - Key: `email_verify:{emailVerifyCode}`
   - Value: `{userId}`
   - 过期时间: 30分钟

6. 邮箱登录验证码 (`email_login:{emailLoginCode}`)：
   - 存储用户邮箱登录的验证码及相关信息
   - Key: `email_login:{emailLoginCode}`
   - Value: `{userId}`
   - 过期时间: 10分钟

7. 扫码登录信息 (`scan_login:{scanLoginId}`)：
   - 存储扫码登录的ID和相关信息
   - Key: `scan_login:{scanLoginId}`
   - Value: `{status, userId}`
   - 过期时间: 5分钟

8. 文件上传信息 (`upload:{uploadId}`)：
   - 存储文件分片上传的相关信息
   - Key: `upload:{uploadId}`
   - Value: `{fileId, fileName, fileSize, chunkSize, mimeType, userId, totalChunks, uploadedChunks, createdAt}`
   - 过期时间: 24小时

9. WebAuthn 验证临时信息 (`webauthn_challenge:{challenge}`)：
   - 存储每个用户的 WebAuthn 挑战信息
   - Key: `webauthn_challenge:{challenge}`   
   - Value: `{userId}`
   - 过期时间: 1分钟

10. 消息广播频道 (`ventichat_messages`)：
   - 用于在多个工作进程间广播实时消息
   - 通过Redis的Pub/Sub机制实现跨进程、跨服务器的实时消息发送

### 使用场景
1. WebSocket会话管理：管理用户的多个实时连接
2. 用户状态同步：同步用户状态
3. Token存储：验证用户身份
4. IP封禁：存储封禁的IP地址
5. 邮箱验证：存储用户注册时的邮箱验证信息
6. 邮箱登录：存储用户邮箱登录的验证码信息
7. 扫码登录：存储扫码登录的临时信息
8. 文件上传：存储文件上传的临时信息
9. WebAuthn：存储用户 WebAuthn 验证临时信息
10. 实时消息广播：通过Redis Pub/Sub实现跨服务器的实时消息发送