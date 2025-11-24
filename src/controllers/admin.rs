//! 管理控制器
//! 处理系统管理功能，仅限管理员使用
use venti_chat::AppState;
use crate::models::{User, Room};
use axum::{
    extract::{State, Extension, Path, Query},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// 系统设置
#[derive(Serialize, Deserialize, FromRow)]
pub struct SystemSettings {
    pub setting_id: i32,
    pub message_retention_days: i32,
    pub max_file_size: i32,
    pub site_name: String,
    pub allow_user_registration: bool,
    pub max_login_attempts: i32,
    pub login_lock_time: i32,
    pub max_room_members: i32,
}

/// 更新系统设置请求
#[derive(Deserialize)]
pub struct UpdateSystemSettingsRequest {
    pub message_retention_days: Option<i32>,
    pub max_file_size: Option<i32>,
    pub site_name: Option<String>,
    pub allow_user_registration: Option<bool>,
    pub max_login_attempts: Option<i32>,
    pub login_lock_time: Option<i32>,
    pub max_room_members: Option<i32>,
}

/// 用户状态更新请求
#[derive(Deserialize)]
pub struct UpdateUserStatusRequest {
    pub status: String, // "active" 或 "banned"
}

/// 管理员检查中间件
async fn require_admin(user: &User) -> Result<(), (StatusCode, String)> {
    if !user.is_admin {
        return Err((StatusCode::FORBIDDEN, "需要管理员权限".to_string()));
    }
    Ok(())
}

/// 获取系统设置
#[debug_handler]
pub async fn get_system_settings(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
) -> Result<Json<SystemSettings>, (StatusCode, String)> {
    require_admin(&current_user).await?;

    let settings = sqlx::query_as::<_, SystemSettings>(
        "SELECT * FROM system_settings LIMIT 1"
    )
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询系统设置失败".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "系统设置不存在".to_string()))?;

    Ok(Json(settings))
}

/// 更新系统设置
#[debug_handler]
pub async fn update_system_settings(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Json(payload): Json<UpdateSystemSettingsRequest>,
) -> Result<Json<SystemSettings>, (StatusCode, String)> {
    require_admin(&current_user).await?;

    // 构建更新语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(message_retention_days) = payload.message_retention_days {
        updates.push("message_retention_days = ?");
        params.push(message_retention_days.to_string());
    }

    if let Some(max_file_size) = payload.max_file_size {
        updates.push("max_file_size = ?");
        params.push(max_file_size.to_string());
    }

    if let Some(site_name) = &payload.site_name {
        updates.push("site_name = ?");
        params.push(site_name.clone());
    }

    if let Some(allow_user_registration) = payload.allow_user_registration {
        updates.push("allow_user_registration = ?");
        params.push(allow_user_registration.to_string());
    }

    if let Some(max_login_attempts) = payload.max_login_attempts {
        updates.push("max_login_attempts = ?");
        params.push(max_login_attempts.to_string());
    }

    if let Some(login_lock_time) = payload.login_lock_time {
        updates.push("login_lock_time = ?");
        params.push(login_lock_time.to_string());
    }

    if let Some(max_room_members) = payload.max_room_members {
        updates.push("max_room_members = ?");
        params.push(max_room_members.to_string());
    }

    if updates.is_empty() {
        // 如果没有要更新的字段，直接返回当前设置
        return get_system_settings(State(state), Extension(current_user)).await;
    }

    let query = format!("UPDATE system_settings SET {} WHERE setting_id = 1", updates.join(", "));
    
    let mut query_builder = sqlx::query(&query);
    for param in &params {
        query_builder = query_builder.bind(param);
    }
    
    query_builder
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新系统设置失败".to_string()))?;

    // 返回更新后的设置
    get_system_settings(State(state), Extension(current_user)).await
}

/// 获取所有用户列表
#[debug_handler]
pub async fn get_all_users(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    require_admin(&current_user).await?;

    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: u32 = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(50).min(100);
    let offset = (page - 1) * limit;

    let users = sqlx::query_as::<_, User>(&format!(
        "SELECT * FROM users ORDER BY user_id LIMIT {} OFFSET {}",
        limit, offset
    ))
    .fetch_all(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户列表失败".to_string()))?;

    Ok(Json(users))
}

/// 获取用户详情
#[debug_handler]
pub async fn get_user(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(user_id): Path<i32>,
) -> Result<Json<User>, (StatusCode, String)> {
    require_admin(&current_user).await?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户信息失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "用户不存在".to_string()))?;

    Ok(Json(user))
}

/// 更新用户状态（封禁/解封）
#[debug_handler]
pub async fn update_user_status(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(user_id): Path<i32>,
    Json(payload): Json<UpdateUserStatusRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    require_admin(&current_user).await?;

    // 检查用户是否存在
    let _user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户信息失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "用户不存在".to_string()))?;

    // 管理员不能封禁自己
    if user_id == current_user.user_id {
        return Err((StatusCode::BAD_REQUEST, "不能修改自己的状态".to_string()));
    }

    // 更新用户状态
    sqlx::query("UPDATE users SET status = ? WHERE user_id = ?")
        .bind(&payload.status)
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新用户状态失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 删除用户
#[debug_handler]
pub async fn delete_user(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(user_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    require_admin(&current_user).await?;

    // 检查用户是否存在
    let _user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户信息失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "用户不存在".to_string()))?;

    // 管理员不能删除自己
    if user_id == current_user.user_id {
        return Err((StatusCode::BAD_REQUEST, "不能删除自己".to_string()));
    }

    // 删除用户相关数据
    // 删除用户的聊天室成员关系
    sqlx::query("DELETE FROM room_members WHERE user_id = ?")
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除用户成员关系失败".to_string()))?;

    // 删除用户的加入申请
    sqlx::query("DELETE FROM join_requests WHERE user_id = ?")
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除用户加入申请失败".to_string()))?;

    // 删除用户发送的消息
    sqlx::query("DELETE FROM messages WHERE user_id = ?")
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除用户消息失败".to_string()))?;

    // 删除用户的令牌
    sqlx::query("DELETE FROM tokens WHERE user_id = ?")
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除用户令牌失败".to_string()))?;

    // 删除用户
    sqlx::query("DELETE FROM users WHERE user_id = ?")
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除用户失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 获取所有聊天室列表
#[debug_handler]
pub async fn get_all_rooms(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<Room>>, (StatusCode, String)> {
    require_admin(&current_user).await?;

    let page: u32 = params.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let limit: u32 = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(50).min(100);
    let offset = (page - 1) * limit;

    let rooms = sqlx::query_as::<_, Room>(&format!(
        "SELECT * FROM rooms ORDER BY room_id LIMIT {} OFFSET {}",
        limit, offset
    ))
    .fetch_all(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室列表失败".to_string()))?;

    Ok(Json(rooms))
}

/// 解散聊天室
#[debug_handler]
pub async fn delete_room(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(room_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    require_admin(&current_user).await?;

    // 检查聊天室是否存在
    let _room = sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询聊天室失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "聊天室不存在".to_string()))?;

    // 删除聊天室相关数据
    // 删除聊天室的加入申请
    sqlx::query("DELETE FROM join_requests WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除加入申请失败".to_string()))?;

    // 删除聊天室成员关系
    sqlx::query("DELETE FROM room_members WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除成员信息失败".to_string()))?;

    // 删除聊天室消息
    sqlx::query("DELETE FROM messages WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除消息失败".to_string()))?;

    // 删除聊天室
    sqlx::query("DELETE FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "删除聊天室失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

/// 重置用户密码
#[debug_handler]
pub async fn reset_user_password(
    State(state): State<AppState>,
    Extension(current_user): Extension<User>,
    Path(user_id): Path<i32>,
) -> Result<StatusCode, (StatusCode, String)> {
    require_admin(&current_user).await?;

    // 检查用户是否存在
    let _user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户信息失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "用户不存在".to_string()))?;

    // 生成默认密码（例如"123456"）
    let default_password = "123456";
    let hashed_password = bcrypt::hash(default_password, bcrypt::DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "密码加密失败".to_string()))?;

    // 更新用户密码
    sqlx::query("UPDATE users SET password_hash = ? WHERE user_id = ?")
        .bind(hashed_password)
        .bind(user_id)
        .execute(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "重置用户密码失败".to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}