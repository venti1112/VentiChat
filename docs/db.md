# 数据库结构说明

## 表结构总览

### 1. users 表 - 用户信息表
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

### 2. rooms 表 - 聊天室信息表
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
| members | JSON | DEFAULT '[]' | 聊天室成员ID列表，JSON数组格式，用于快速查询 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 聊天室的创建时间，系统自动记录 |

### 3. room_members 表 - 聊天室成员表
存储用户与聊天室之间的关联关系和成员权限

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| user_id | INT | PRIMARY KEY | 用户ID，与room_id共同构成复合主键 |
| room_id | INT | PRIMARY KEY | 聊天室ID，与user_id共同构成复合主键 |
| is_moderator | BOOLEAN | DEFAULT false | 是否为聊天室管理员：true-是管理员，false-普通成员 |
| note | VARCHAR(100) |  | 成员备注信息，可由管理员设置 |
| last_read_message_id | INT | DEFAULT 0 | 用户最后阅读的消息ID，用于计算未读消息数量 |
| join_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 用户加入聊天室的时间，系统自动记录 |

### 4. messages 表 - 消息记录表
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

### 5. join_requests 表 - 加入申请表
存储用户申请加入聊天室的记录和审批状态

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| request_id | INT | PRIMARY KEY, AUTO_INCREMENT | 加入申请的唯一标识符，系统自动生成 |
| status | ENUM('pending','approved','rejected') | DEFAULT 'pending' | 申请状态：pending-待处理，approved-已批准，rejected-已拒绝 |
| request_message | VARCHAR(255) |  | 用户提交申请时的附言 |
| user_id | INT | NOT NULL | 提交申请的用户ID |
| room_id | INT | NOT NULL | 申请加入的聊天室ID |
| request_time | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 申请提交时间，系统自动记录 |

### 6. tokens 表 - 令牌管理表
存储用户登录会话的JWT令牌信息

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| token_str | VARCHAR(255) | PRIMARY KEY | JWT令牌的完整字符串，作为主键 |
| user_id | INT | NOT NULL | 令牌关联的用户ID |
| expires_at | DATETIME | NOT NULL | 令牌的过期时间，过期后自动失效 |

### 7. system_settings 表 - 系统设置表
存储系统全局配置参数

| 字段名 | 数据类型 | 约束条件 | 用途说明 |
|--------|----------|----------|----------|
| setting_id | INT | PRIMARY KEY, AUTO_INCREMENT | 系统设置项的唯一标识符（永远是1） |
| message_retention_days | INT | DEFAULT 180 | 全局消息保留天数，超过天数的消息自动清理 |
| max_file_size | INT | DEFAULT 10485760 | 上传文件最大大小（字节），默认10MB |
| site_name | VARCHAR(255) | DEFAULT VentiChat | 网站显示名称 |
| allow_user_registration | BOOLEAN | DEFAULT true | 是否允许新用户注册：true-允许，false-禁止 |
| max_login_attempts | INT | DEFAULT 5 | 最大登录尝试次数，超过次数会暂时锁定账户 |
| max_room_members | INT | DEFAULT 1000 | 单个聊天室最大成员数量 |

## 权限层级说明

### 1. 系统管理员 (users.is_admin)
- **权限范围**：整个系统
- **管理权限**：
  - 管理所有用户账号
  - 管理所有聊天室
  - 配置系统全局设置
  - 查看系统日志和统计数据

### 2. 聊天室创建者 (room_members.is_moderator)
- **权限范围**：单个聊天室
- **管理权限**：
  - 管理聊天室成员
  - 审批加入申请
  - 删除聊天室消息
  - 设置聊天室规则
  - 解散聊天室

### 3. 聊天室管理员 (room_members.is_moderator)
- **权限范围**：单个聊天室
- **管理权限**：
  - 管理聊天室成员
  - 审批加入申请
  - 删除聊天室消息
  - 设置聊天室规则

### 4. 普通用户
- **权限范围**：个人账号和加入的聊天室
- **基本权限**：
  - 修改个人信息
  - 发送消息
  - 申请加入聊天室
  - 创建新聊天室

*注：所有上级权限都拥有下级的所有权限

## 约束条件说明

### 主键约束 (PRIMARY KEY)
- **作用**：唯一标识表中的每一行记录
- **特点**：值必须唯一且不能为空

### 自动递增 (AUTO_INCREMENT)
- **作用**：自动为每行记录生成唯一的递增值
- **特点**：通常与主键配合使用，保证标识符唯一性

### 唯一约束 (UNIQUE)
- **作用**：确保列中的所有值都是唯一的
- **特点**：防止重复值，允许空值（除非同时有NOT NULL）

### 非空约束 (NOT NULL)
- **作用**：确保列不能包含空值
- **特点**：强制要求该字段必须有值

### 默认值约束 (DEFAULT)
- **作用**：插入数据时如果未提供值，则使用默认值
- **特点**：提供合理的默认值，简化插入操作

### 枚举约束 (ENUM)
- **作用**：限制列的值只能是指定列表中的值
- **特点**：提供预定义选项，保证数据一致性

### 复合主键
- **作用**：使用多个列的组合作为主键
- **特点**：确保多个列的组合是唯一的