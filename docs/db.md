# 数据库结构说明

## 1. users 表
存储系统用户基本信息

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 用户唯一标识 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 登录用户名（唯一） |
| nickname | VARCHAR(50) | NOT NULL | 用户显示昵称 |
| password_hash | VARCHAR(255) | NOT NULL | BCrypt加密后的密码 |
| avatar_url | VARCHAR(255) | | 头像存储路径 |
| status | ENUM('active','banned') | DEFAULT 'active' | 账号状态（正常/封禁） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 账号创建时间 |

## 2. rooms 表
存储聊天室基本信息

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 聊天室唯一标识 |
| name | VARCHAR(100) | NOT NULL | 聊天室名称 |
| creator_id | INT | NOT NULL | 创建者ID（外键） |
| is_private | BOOLEAN | DEFAULT false | 是否私密聊天室 |
| require_approval | BOOLEAN | DEFAULT true | 加入是否需要审批 |
| allow_images | BOOLEAN | DEFAULT true | 是否允许发送图片 |
| allow_videos | BOOLEAN | DEFAULT true | 是否允许发送视频 |
| allow_files | BOOLEAN | DEFAULT true | 是否允许发送文件 |
| retention_days | INT | DEFAULT 180 | 消息保留天数 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

## 3. room_members 表
存储用户与聊天室的关联关系

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| user_id | INT | PRIMARY KEY, FOREIGN KEY | 用户ID（外键） |
| room_id | INT | PRIMARY KEY, FOREIGN KEY | 聊天室ID（外键） |
| is_moderator | BOOLEAN | DEFAULT false | 是否为管理员 |
| join_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 加入时间 |
| note | VARCHAR(100) | | 成员备注 |
| last_read_message_id | INT | DEFAULT 0 | 最后已读消息ID（用于未读计数） |

## 4. messages 表
存储聊天消息内容

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 消息唯一标识 |
| room_id | INT | NOT NULL, FOREIGN KEY | 所属聊天室ID |
| sender_id | INT | NOT NULL, FOREIGN KEY | 发送者ID |
| content | TEXT | | 消息文本内容 |
| type | ENUM('text','image','video','file') | DEFAULT 'text' | 消息类型 |
| file_url | VARCHAR(255) | | 附件存储路径 |
| sent_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 发送时间 |
| is_deleted | BOOLEAN | DEFAULT false | 是否已撤回 |

## 5. JoinRequests 表
存储聊天室加入申请

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 申请记录ID |
| status | ENUM('pending','approved','rejected') | DEFAULT 'pending' | 申请状态 |
| message | VARCHAR(255) | | 申请附言 |
| user_id | INT | NOT NULL, FOREIGN KEY | 申请人ID |
| room_id | INT | NOT NULL, FOREIGN KEY | 申请房间ID |
| request_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 申请时间 |

## 6. tokens 表
存储用户会话令牌

| 字段名 | 数据类型 | 约束 | 用途说明 |
|--------|----------|------|----------|
| token_str | VARCHAR(255) | PRIMARY KEY | JWT令牌字符串 |
| user_id | INT | NOT NULL, FOREIGN KEY | 关联用户ID |
| expires_at | DATETIME | NOT NULL | 令牌过期时间 |

> **外键关系说明**
> - rooms.creator_id → users.id
> - room_members.user_id → users.id
> - room_members.room_id → rooms.id
> - messages.sender_id → users.id
> - messages.room_id → rooms.id
> - JoinRequests.user_id → users.id
> - JoinRequests.room_id → rooms.id
> - tokens.user_id → users.id

> **特殊字段说明**
> - `room_members.last_read_message_id`: 用于计算未读消息数量，通过比较该值与最新消息ID
> - `messages.is_deleted`: 实现消息撤回功能（10分钟内可撤回）
> - `tokens`表: 实现基于数据库的Token管理，支持即时会话失效