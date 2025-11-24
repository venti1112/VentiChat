//! 聊天室控制器
//! 处理聊天室的创建、管理、成员操作等功能

use crate::models::{Room, RoomMember, JoinRequest, User};
use venti_chat::AppState;
use axum::{
    extract::{State, Extension, Path},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;

/// 创建聊天室请求
#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub is_private: Option<bool>,
    pub require_approval: Option<bool>,
    pub allow_images: Option<bool>,
    pub allow_videos: Option<bool>,
    pub allow_files: Option<bool>,
}

/// 更新聊天室请求
#[derive(Deserialize)]
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub is_private: Option<bool>,
    pub require_approval: Option<bool>,
    pub allow_images: Option<bool>,
    pub allow_videos: Option<bool>,
    pub allow_files: Option<bool>,
}

/// 申请加入聊天室请求
#[derive(Deserialize)]
pub struct JoinRoomRequest {
    pub request_message: Option<String>,
}

/// 处理加入申请请求
#[derive(Deserialize)]
pub struct HandleJoinRequest {
    pub action: String, // "approve" 或 "reject"
}

/// 聊天室信息响应
#[derive(Serialize, FromRow)]
pub struct RoomResponse {
    pub room_id: i32,
    pub name: String,
    pub creator_id: i32,
    pub is_private: bool,
    pub require_approval: bool,
    pub allow_images: bool,
    pub allow_videos: bool,
    pub allow_files: bool,
    pub created_at: String,
}

/// 聊天室成员信息响应
#[derive(Serialize, FromRow)]
pub struct RoomMemberResponse {
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub is_moderator: bool,
    pub note: Option<String>,
    pub join_time: String,
}

/// 加入申请信息响应
#[derive(Serialize)]
pub struct JoinRequestResponse {
    pub request_id: i32,
    pub status: String,
    pub request_message: Option<String>,
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub room_id: i32,
    pub room_name: String,
    pub request_time: String,
}

impl From<Room> for RoomResponse {
    fn from(room: Room) -> Self {
        Self {
            room_id: room.room_id,
            name: room.name,
            creator_id: room.creator_id,
            is_private: room.is_private,
            require_approval: room.require_approval,
            allow_images: room.allow_images,
            allow_videos: room.allow_videos,
            allow_files: room.allow_files,
            created_at: room.created_at.to_rfc3339(),
        }
    }
}

/// 创建聊天室
#[debug_handler]
pub async fn create_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Json(payload): Json<CreateRoomRequest>,
) -> Result<(StatusCode, Json<RoomResponse>), (StatusCode, String)> {
    // 创建聊天室
    let room = sqlx::query_as::<_, Room>(
        r#"INSERT INTO rooms (name, creator_id, is_private, require_approval, allow_images, allow_videos, allow_files)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           RETURNING *"#
    )
    .bind(&payload.name)
    .bind(current_user.user_id)
    .bind(payload.is_private.unwrap_or(false))
    .bind(payload.require_approval.unwrap_or(true))
    .bind(payload.allow_images.unwrap_or(true))
    .bind(payload.allow_videos.unwrap_or(true))
    .bind(payload.allow_files.unwrap_or(true))
    .fetch_one(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "创建聊天室失败".to_string()))?;

    // 创建者自动成为聊天室成员和管理员
    sqlx::query(
        r#"INSERT INTO room_members (user_id, room_id, is_moderator)
           VALUES (?, ?, ?)"#
    )
    .bind(current_user.user_id)
    .bind(room.room_id)
    .bind(true) // 创建者自动成为管理员
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "创建聊天室成员关系失败".to_string()))?;

    Ok((StatusCode::CREATED, Json(RoomResponse::from(room))))
}

/// 获取用户加入的所有聊天室
#[debug_handler]
pub async fn get_user_rooms(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
) -> Result<Json<Vec<RoomResponse>>, (StatusCode, String)> {
    let rooms = sqlx::query_as::<_, Room>(
        r#"SELECT r.* FROM rooms r
           JOIN room_members rm ON r.room_id = rm.room_id
           WHERE rm.user_id = ?"#
    )
    .bind(current_user.user_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?;

    let room_responses: Vec<RoomResponse> = rooms.into_iter().map(RoomResponse::from).collect();
    Ok(Json(room_responses))
}

/// 获取聊天室详情
#[debug_handler]
pub async fn get_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
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

    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    Ok(Json(RoomResponse::from(room)))
}

/// 更新聊天室信息
#[debug_handler]
pub async fn update_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
    Json(payload): Json<UpdateRoomRequest>,
) -> Result<Json<RoomResponse>, (StatusCode, String)> {
    // 检查用户是否是聊天室创建者
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    if room.creator_id != current_user.user_id {
        return Err((StatusCode::FORBIDDEN, "只有聊天室创建者可以修改聊天室信息".to_string()));
    }

    // 构建更新语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(name) = &payload.name {
        updates.push("name = ?");
        params.push(name.clone());
    }

    if let Some(is_private) = payload.is_private {
        updates.push("is_private = ?");
        params.push(is_private.to_string());
    }

    if let Some(require_approval) = payload.require_approval {
        updates.push("require_approval = ?");
        params.push(require_approval.to_string());
    }

    if let Some(allow_images) = payload.allow_images {
        updates.push("allow_images = ?");
        params.push(allow_images.to_string());
    }

    if let Some(allow_videos) = payload.allow_videos {
        updates.push("allow_videos = ?");
        params.push(allow_videos.to_string());
    }

    if let Some(allow_files) = payload.allow_files {
        updates.push("allow_files = ?");
        params.push(allow_files.to_string());
    }

    if updates.is_empty() {
        return Ok(Json(RoomResponse::from(room)));
    }

    let query = format!("UPDATE rooms SET {} WHERE room_id = ?", updates.join(", "));
    params.push(room_id.to_string());

    let mut query_builder = sqlx::query(&query);
    for param in &params {
        query_builder = query_builder.bind(param);
    }

    query_builder
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新聊天室失败".to_string()))?;

    // 查询更新后的聊天室信息
    let updated_room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    Ok(Json(RoomResponse::from(updated_room)))
}

/// 解散聊天室（仅创建者可以操作）
#[debug_handler]
pub async fn delete_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查用户是否是聊天室创建者
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    if room.creator_id != current_user.user_id {
        return Err((StatusCode::FORBIDDEN, "只有聊天室创建者可以解散聊天室".to_string()));
    }

    // 删除聊天室相关数据
    // 注意：实际应用中应该使用事务来确保数据一致性
    sqlx::query("DELETE FROM join_requests WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除加入申请失败".to_string()))?;

    sqlx::query("DELETE FROM room_members WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除成员信息失败".to_string()))?;

    sqlx::query("DELETE FROM messages WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除消息失败".to_string()))?;

    sqlx::query("DELETE FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除聊天室失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 申请加入聊天室
#[debug_handler]
pub async fn request_join_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
    Json(payload): Json<JoinRoomRequest>,
) -> Result<(StatusCode, Json<HashMap<String, String>>), (StatusCode, String)> {
    // 检查聊天室是否存在
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    // 检查是否已经是成员
    let existing_member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if existing_member.is_some() {
        return Err((StatusCode::BAD_REQUEST, "您已经是该聊天室的成员".to_string()));
    }

    // 如果聊天室不需要审批，直接加入
    if !room.require_approval {
        sqlx::query(
            r#"INSERT INTO room_members (user_id, room_id, is_moderator)
               VALUES (?, ?, ?)"#
        )
        .bind(current_user.user_id)
        .bind(room_id)
        .bind(false) // 默认不是管理员
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "加入聊天室失败".to_string()))?;

        let mut response = HashMap::new();
        response.insert("message".to_string(), "成功加入聊天室".to_string());
        return Ok((StatusCode::CREATED, Json(response)));
    }

    // 检查是否已经有待处理的申请
    let existing_request = sqlx::query_as::<_, JoinRequest>(
        "SELECT * FROM join_requests WHERE user_id = ? AND room_id = ? AND status = 'pending'"
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询申请信息失败".to_string()))?;

    if existing_request.is_some() {
        return Err((StatusCode::BAD_REQUEST, "您已经提交了加入申请，请等待审核".to_string()));
    }

    // 创建加入申请
    sqlx::query(
        r#"INSERT INTO join_requests (user_id, room_id, request_message)
           VALUES (?, ?, ?)"#
    )
    .bind(current_user.user_id)
    .bind(room_id)
    .bind(&payload.request_message.unwrap_or_default())
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "提交加入申请失败".to_string()))?;

    let mut response = HashMap::new();
    response.insert("message".to_string(), "申请已提交，等待管理员审核".to_string());
    Ok((StatusCode::CREATED, Json(response)))
}

/// 获取聊天室成员列表
#[debug_handler]
pub async fn get_room_members(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
) -> Result<Json<Vec<RoomMemberResponse>>, (StatusCode, String)> {
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

    // 查询聊天室成员
    let members = sqlx::query_as::<_, RoomMemberResponse>(
        r#"SELECT u.user_id, u.username, u.nickname, rm.is_moderator, rm.note, rm.join_time
           FROM room_members rm
           JOIN users u ON rm.user_id = u.user_id
           WHERE rm.room_id = ?"#
    )
    .bind(room_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员列表失败".to_string()))?;

    let member_responses: Vec<RoomMemberResponse> = members.into_iter().map(|mut m| {
        m.join_time = chrono::DateTime::parse_from_rfc3339(&m.join_time)
            .map(|dt| dt.with_timezone(&chrono::Utc).to_rfc3339())
            .unwrap_or(m.join_time);
        m
    }).collect();

    Ok(Json(member_responses))
}

/// 退出聊天室
#[debug_handler]
pub async fn leave_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
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

    // 检查是否是聊天室创建者
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    if room.creator_id == current_user.user_id {
        return Err((StatusCode::FORBIDDEN, "聊天室创建者不能退出聊天室，请先解散聊天室".to_string()));
    }

    // 删除成员关系
    sqlx::query("DELETE FROM room_members WHERE user_id = ? AND room_id = ?")
        .bind(current_user.user_id)
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "退出聊天室失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}