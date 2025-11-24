//! 模型模块
//! 定义数据模型和数据库操作

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use sqlx::FromRow;

/// 用户模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub password_hash: String,
    pub avatar_url: String,
    pub background_url: String,
    pub theme_color: String,
    pub is_admin: bool,
    pub status: String, // active, banned
    pub login_attempts: i32,
    pub last_login_attempt: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// 聊天室模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub room_id: i32,
    pub name: String,
    pub creator_id: i32,
    pub is_private: bool,
    pub require_approval: bool,
    pub allow_images: bool,
    pub allow_videos: bool,
    pub allow_files: bool,
    pub created_at: DateTime<Utc>,
}

/// 聊天室成员模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RoomMember {
    pub user_id: i32,
    pub room_id: i32,
    pub is_moderator: bool,
    pub note: Option<String>,
    pub last_read_message_id: i32,
    pub join_time: DateTime<Utc>,
}

/// 消息模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub message_id: i32,
    pub room_id: i32,
    pub user_id: i32,
    pub content: String,
    pub message_type: String, // text, image, video, file
    pub file_url: Option<String>,
    pub file_size: i32,
    pub is_deleted: bool,
    pub sent_at: DateTime<Utc>,
}

/// 加入请求模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct JoinRequest {
    pub request_id: i32,
    pub status: String, // pending, approved, rejected
    pub request_message: Option<String>,
    pub user_id: i32,
    pub room_id: i32,
    pub request_time: DateTime<Utc>,
}