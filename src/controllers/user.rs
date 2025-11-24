//! 用户控制器
//! 处理用户信息相关的操作

use crate::models::User;
use venti_chat::AppState;
use axum::{
    extract::{State, Extension},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};

/// 更新用户信息请求
#[derive(Deserialize)]
pub struct UpdateUserInfoRequest {
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub background_url: Option<String>,
    pub theme_color: Option<String>,
}

/// 用户信息响应
#[derive(Serialize)]
pub struct UserInfoResponse {
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub avatar_url: String,
    pub background_url: String,
    pub theme_color: String,
    pub is_admin: bool,
    pub status: String,
    pub created_at: String,
}

/// 获取当前用户信息
#[debug_handler]
pub async fn get_current_user(
    State(_state): State<AppState>,
    Extension(user): Extension<User>,
) -> Result<Json<UserInfoResponse>, StatusCode> {
    let response = UserInfoResponse {
        user_id: user.user_id,
        username: user.username,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        background_url: user.background_url,
        theme_color: user.theme_color,
        is_admin: user.is_admin,
        status: user.status,
        created_at: user.created_at.to_rfc3339(),
    };

    Ok(Json(response))
}

/// 更新当前用户信息
#[debug_handler]
pub async fn update_current_user(
    State(state): State<AppState>,
    Extension(user): Extension<User>,
    Json(payload): Json<UpdateUserInfoRequest>,
) -> Result<Json<UserInfoResponse>, (StatusCode, String)> {
    // 更新用户信息
    if let Some(nickname) = payload.nickname {
        sqlx::query("UPDATE users SET nickname = ? WHERE user_id = ?")
            .bind(&nickname)
            .bind(user.user_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新昵称失败".to_string()))?;
    }

    if let Some(avatar_url) = payload.avatar_url {
        sqlx::query("UPDATE users SET avatar_url = ? WHERE user_id = ?")
            .bind(&avatar_url)
            .bind(user.user_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新头像失败".to_string()))?;
    }

    if let Some(background_url) = payload.background_url {
        sqlx::query("UPDATE users SET background_url = ? WHERE user_id = ?")
            .bind(&background_url)
            .bind(user.user_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新背景图失败".to_string()))?;
    }

    if let Some(theme_color) = payload.theme_color {
        sqlx::query("UPDATE users SET theme_color = ? WHERE user_id = ?")
            .bind(&theme_color)
            .bind(user.user_id)
            .execute(state.db.pool())
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "更新主题色失败".to_string()))?;
    }

    // 查询更新后的用户信息
    let updated_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user.user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "查询用户信息失败".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "用户不存在".to_string()))?;

    let response = UserInfoResponse {
        user_id: updated_user.user_id,
        username: updated_user.username,
        nickname: updated_user.nickname,
        avatar_url: updated_user.avatar_url,
        background_url: updated_user.background_url,
        theme_color: updated_user.theme_color,
        is_admin: updated_user.is_admin,
        status: updated_user.status,
        created_at: updated_user.created_at.to_rfc3339(),
    };

    Ok(Json(response))
}