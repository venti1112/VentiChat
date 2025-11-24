//! 聊天室管理控制器
//! 处理聊天室成员管理和加入申请审批等管理功能

use crate::{AppState, models::{Room, RoomMember, JoinRequest, User}};
use axum::{
    extract::{State, Extension, Path},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono;

/// 设置成员为管理员请求
#[derive(Deserialize)]
pub struct SetModeratorRequest {
    pub is_moderator: bool,
}

/// 处理加入申请请求
#[derive(Deserialize)]
pub struct HandleJoinRequest {
    pub action: String, // "approve" 或 "reject"
}

/// 加入申请信息响应
#[derive(Serialize, FromRow)]
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

/// 检查用户是否是聊天室的管理员（创建者或管理员）
async fn is_room_moderator(pool: &sqlx::MySqlPool, user_id: i32, room_id: i32) -> Result<bool, (StatusCode, String)> {
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(user_id)
    .bind(room_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    match member {
        Some(m) => Ok(m.is_moderator),
        None => Ok(false),
    }
}

/// 添加聊天室成员（仅管理员可以操作）
#[debug_handler]
pub async fn add_member(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path((room_id, user_id)): Path<(i32, i32)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查当前用户是否是聊天室管理员
    let is_moderator = is_room_moderator(state.db.pool(), current_user.user_id, room_id).await?;
    if !is_moderator {
        return Err((StatusCode::FORBIDDEN, "只有聊天室管理员可以添加成员".to_string()));
    }

    // 检查用户是否已经是成员
    let existing_member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if existing_member.is_some() {
        return Err((StatusCode::BAD_REQUEST, "该用户已经是聊天室成员".to_string()));
    }

    // 添加成员
    sqlx::query(
        "INSERT INTO room_members (user_id, room_id, is_moderator) VALUES (?, ?, ?)"
    )
    .bind(user_id)
    .bind(room_id)
    .bind(false) // 默认不是管理员
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "添加成员失败".to_string()))?;

    // 如果有加入申请，更新申请状态为已批准
    sqlx::query(
        "UPDATE join_requests SET status = 'approved' WHERE user_id = ? AND room_id = ?"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新申请状态失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 移除聊天室成员（仅管理员可以操作）
#[debug_handler]
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path((room_id, user_id)): Path<(i32, i32)>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查当前用户是否是聊天室管理员
    let is_moderator = is_room_moderator(state.db.pool(), current_user.user_id, room_id).await?;
    if !is_moderator {
        return Err((StatusCode::FORBIDDEN, "只有聊天室管理员可以移除成员".to_string()));
    }

    // 检查是否试图移除自己
    if current_user.user_id == user_id {
        return Err((StatusCode::BAD_REQUEST, "不能移除自己，请使用退出功能".to_string()));
    }

    // 检查是否是聊天室创建者
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    if room.creator_id == user_id {
        return Err((StatusCode::FORBIDDEN, "不能移除聊天室创建者".to_string()));
    }

    // 移除成员
    let rows_affected = sqlx::query(
        "DELETE FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(user_id)
    .bind(room_id)
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "移除成员失败".to_string()))?
    .rows_affected();

    if rows_affected == 0 {
        return Err((StatusCode::NOT_FOUND, "成员不存在".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// 设置成员管理员权限（仅创建者可以操作）
#[debug_handler]
pub async fn set_moderator(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path((room_id, user_id)): Path<(i32, i32)>,
    Json(payload): Json<SetModeratorRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查当前用户是否是聊天室创建者
    let room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    if room.creator_id != current_user.user_id {
        return Err((StatusCode::FORBIDDEN, "只有聊天室创建者可以设置管理员权限".to_string()));
    }

    // 检查是否是创建者本人
    if room.creator_id == user_id {
        return Err((StatusCode::BAD_REQUEST, "创建者始终是管理员".to_string()));
    }

    // 检查用户是否是聊天室成员
    let member = sqlx::query_as::<_, RoomMember>(
        "SELECT * FROM room_members WHERE user_id = ? AND room_id = ?"
    )
    .bind(user_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询成员信息失败".to_string()))?;

    if member.is_none() {
        return Err((StatusCode::NOT_FOUND, "用户不是聊天室成员".to_string()));
    }

    // 设置管理员权限
    sqlx::query(
        "UPDATE room_members SET is_moderator = ? WHERE user_id = ? AND room_id = ?"
    )
    .bind(payload.is_moderator)
    .bind(user_id)
    .bind(room_id)
    .execute(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "设置管理员权限失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 获取聊天室加入申请列表（仅管理员可以查看）
#[debug_handler]
pub async fn get_join_requests(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
) -> Result<Json<Vec<JoinRequestResponse>>, (StatusCode, String)> {
    // 检查当前用户是否是聊天室管理员
    let is_moderator = is_room_moderator(state.db.pool(), current_user.user_id, room_id).await?;
    if !is_moderator {
        return Err((StatusCode::FORBIDDEN, "只有聊天室管理员可以查看加入申请".to_string()));
    }

    // 查询加入申请
    let requests = sqlx::query_as::<_, JoinRequestResponse>(
        r#"SELECT jr.request_id, jr.status, jr.request_message, 
                  u.user_id, u.username, u.nickname,
                  r.room_id, r.name as room_name, jr.request_time
           FROM join_requests jr
           JOIN users u ON jr.user_id = u.user_id
           JOIN rooms r ON jr.room_id = r.room_id
           WHERE jr.room_id = ? AND jr.status = 'pending'"#
    )
    .bind(room_id)
    .fetch_all(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询加入申请失败".to_string()))?;

    let request_responses: Vec<JoinRequestResponse> = requests.into_iter().map(|mut r| {
        r.request_time = chrono::DateTime::parse_from_rfc3339(&r.request_time)
            .map(|dt| dt.with_timezone(&chrono::Utc).to_rfc3339())
            .unwrap_or(r.request_time);
        r
    }).collect();

    Ok(Json(request_responses))
}

/// 处理加入申请（仅管理员可以操作）
#[debug_handler]
pub async fn handle_join_request(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path((room_id, request_id)): Path<(i32, i32)>,
    Json(payload): Json<HandleJoinRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    // 检查当前用户是否是聊天室管理员
    let is_moderator = is_room_moderator(state.db.pool(), current_user.user_id, room_id).await?;
    if !is_moderator {
        return Err((StatusCode::FORBIDDEN, "只有聊天室管理员可以处理加入申请".to_string()));
    }

    // 获取申请信息
    let request = sqlx::query_as::<_, JoinRequest>(
        "SELECT * FROM join_requests WHERE request_id = ? AND room_id = ?"
    )
    .bind(request_id)
    .bind(room_id)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询申请信息失败".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "申请不存在".to_string()))?;

    if request.status != "pending" {
        return Err((StatusCode::BAD_REQUEST, "申请已被处理".to_string()));
    }

    // 根据操作类型处理申请
    match payload.action.as_str() {
        "approve" => {
            // 添加成员
            sqlx::query(
                "INSERT INTO room_members (user_id, room_id, is_moderator) VALUES (?, ?, ?)"
            )
            .bind(request.user_id)
            .bind(request.room_id)
            .bind(false) // 默认不是管理员
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "添加成员失败".to_string()))?;

            // 更新申请状态
            sqlx::query(
                "UPDATE join_requests SET status = 'approved' WHERE request_id = ?"
            )
            .bind(request_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新申请状态失败".to_string()))?;
        },
        "reject" => {
            // 更新申请状态
            sqlx::query(
                "UPDATE join_requests SET status = 'rejected' WHERE request_id = ?"
            )
            .bind(request_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新申请状态失败".to_string()))?;
        },
        _ => return Err((StatusCode::BAD_REQUEST, "无效的操作类型".to_string())),
    }

    Ok(StatusCode::NO_CONTENT)
}