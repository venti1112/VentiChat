//! 消息控制器
//! 处理消息的发送、获取、撤回等功能

use crate::models::{Message, Room, RoomMember, User};
use venti_chat::AppState;
use axum::{
    extract::{State, Extension, Path, Query},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono;
use std::collections::HashMap;

/// 发送消息请求
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub message_type: Option<String>, // text, image, video, file
    pub file_url: Option<String>,
    pub file_size: Option<i32>,
}

/// 消息查询参数
#[derive(Deserialize)]
pub struct MessageQuery {
    pub before: Option<i32>, // 获取指定消息ID之前的消息
    pub limit: Option<u32>,  // 限制返回消息数量，默认50
}

/// 消息响应
#[derive(Serialize, FromRow)]
pub struct MessageResponse {
    pub message_id: i32,
    pub room_id: i32,
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub content: String,
    pub message_type: String,
    pub file_url: Option<String>,
    pub file_size: i32,
    pub is_deleted: bool,
    pub sent_at: String,
}

/// 消息列表响应
#[derive(Serialize)]
pub struct MessageListResponse {
    pub messages: Vec<MessageResponse>,
    pub has_more: bool,
}

impl From<Message> for MessageResponse {
    fn from(message: Message) -> Self {
        Self {
            message_id: message.message_id,
            room_id: message.room_id,
            user_id: message.user_id,
            username: "".to_string(), // 需要通过关联查询获取
            nickname: "".to_string(), // 需要通过关联查询获取
            content: message.content,
            message_type: message.message_type,
            file_url: message.file_url,
            file_size: message.file_size,
            is_deleted: message.is_deleted,
            sent_at: message.sent_at.to_rfc3339(),
        }
    }
}

/// 发送消息
#[debug_handler]
pub async fn send_message(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), (StatusCode, String)> {
    // 检查用户是否是聊天室成员
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if member.is_none() {
        return Err((StatusCode::FORBIDDEN, "您不是该聊天室的成员".to_string()));
    }

    // 检查聊天室是否存在
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    // 检查是否有发送对应类型消息的权限
    let message_type = payload.message_type.unwrap_or_else(|| "text".to_string());
    match message_type.as_str() {
        "image" if !room.allow_images => {
            return Err((StatusCode::FORBIDDEN, "该聊天室不允许发送图片".to_string()));
        }
        "video" if !room.allow_videos => {
            return Err((StatusCode::FORBIDDEN, "该聊天室不允许发送视频".to_string()));
        }
        "file" if !room.allow_files => {
            return Err((StatusCode::FORBIDDEN, "该聊天室不允许发送文件".to_string()));
        }
        _ => {}
    }

    // 创建消息
    let message = sqlx::query_as::<_, Message>(
        r#"INSERT INTO messages (room_id, user_id, content, type, file_url, file_size)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING *"#
    )
    .bind(room_id)
    .bind(current_user.user_id)
    .bind(&payload.content)
    .bind(&message_type)
    .bind(&payload.file_url)
    .bind(payload.file_size.unwrap_or(0))
    .fetch_one(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "发送消息失败".to_string()))?;

    // 构建响应
    let response = MessageResponse {
        message_id: message.message_id,
        room_id: message.room_id,
        user_id: message.user_id,
        username: current_user.username,
        nickname: current_user.nickname,
        content: message.content,
        message_type: message.message_type,
        file_url: message.file_url,
        file_size: message.file_size,
        is_deleted: message.is_deleted,
        sent_at: message.sent_at.to_rfc3339(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// 获取聊天室消息历史
#[debug_handler]
pub async fn get_messages(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
    Query(params): Query<MessageQuery>,
) -> Result<Json<MessageListResponse>, (StatusCode, String)> {
    // 检查用户是否是聊天室成员
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if member.is_none() {
        return Err((StatusCode::FORBIDDEN, "您不是该聊天室的成员".to_string()));
    }

    // 构建查询语句
    let limit = params.limit.unwrap_or(50).min(100); // 最多返回100条消息
    let mut query = format!(
        r#"SELECT m.*, u.username, u.nickname
           FROM messages m
           JOIN users u ON m.user_id = u.user_id
           WHERE m.room_id = ? AND m.is_deleted = FALSE"#
    );

    let mut query_params: Vec<String> = vec![];

    query.push_str(" AND m.room_id = ?");
    query_params.push(room_id.to_string());

    if let Some(before_id) = params.before {
        query.push_str(" AND m.message_id < ?");
        query_params.push(before_id.to_string());
    }

    query.push_str(" ORDER BY m.message_id DESC LIMIT ?");
    query_params.push((limit + 1).to_string()); // 多取一条用于判断是否还有更多消息

    // 构建查询参数
    let mut query_builder = sqlx::query_as::<_, MessageResponse>(&query);
    for param in &query_params {
        query_builder = query_builder.bind(param);
    }

    let mut messages = query_builder
        .fetch_all(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询消息失败".to_string()))?;

    // 判断是否还有更多消息
    let has_more = messages.len() > limit as usize;
    if has_more {
        messages.pop(); // 移除多取的那一条
    }

    // 按时间顺序排列（从早到晚）
    messages.reverse();

    let response = MessageListResponse {
        messages,
        has_more,
    };

    Ok(Json(response))
}

/// 撤回消息
#[debug_handler]
pub async fn recall_message(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path((room_id, message_id)): Path<(i32, i32)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查用户是否是聊天室成员
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if member.is_none() {
        return Err((StatusCode::FORBIDDEN, "您不是该聊天室的成员".to_string()));
    }

    // 获取消息信息
    let message = sqlx::query_as::<_, Message>(
        "SELECT * FROM messages WHERE message_id = ? AND room_id = ?"
    )
    .bind(message_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询消息失败".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "消息不存在".to_string()))?;

    // 检查是否是消息发送者
    if message.user_id != current_user.user_id {
        return Err((StatusCode::FORBIDDEN, "只能撤回自己的消息".to_string()));
    }

    // 检查消息发送时间（10分钟内可以撤回）
    let sent_time = message.sent_at.timestamp();
    let current_time = chrono::Utc::now().timestamp();
    if current_time - sent_time > 10 * 60 {
        return Err((StatusCode::FORBIDDEN, "消息发送超过10分钟，无法撤回".to_string()));
    }

    // 撤回消息（标记为已删除）
    sqlx::query("UPDATE messages SET is_deleted = TRUE WHERE message_id = ?")
        .bind(message_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "撤回消息失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}