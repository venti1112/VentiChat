//! 认证控制器
//! 处理用户注册、登录和令牌管理

use crate::models::User;
use venti_chat::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::{Deserialize, Serialize};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, Header, EncodingKey};
use std::time::{SystemTime, UNIX_EPOCH};
use std::env;

/// 登录请求参数
#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// 注册请求参数
#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub nickname: String,
}

/// 认证响应
#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

/// 用户信息响应
#[derive(Serialize)]
pub struct UserResponse {
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub avatar_url: String,
    pub background_url: String,
    pub theme_color: String,
    pub is_admin: bool,
}

/// JWT Claims 结构
#[derive(Serialize, Deserialize)]
struct Claims {
    sub: i32, // 用户ID
    exp: usize, // 过期时间
}

/// 处理用户注册
#[debug_handler]
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, String)> {
    // 检查用户名是否已存在
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?"
    )
    .bind(&payload.username)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "数据库查询失败".to_string()))?;

    if existing_user.is_some() {
        return Err((StatusCode::BAD_REQUEST, "用户名已存在".to_string()));
    }

    // 对密码进行哈希处理
    let hashed_password = hash(&payload.password, DEFAULT_COST)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "密码加密失败".to_string()))?;

    // 创建新用户
    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO users (username, nickname, password_hash, avatar_url, background_url, theme_color, is_admin, status)
           VALUES (?, ?, ?, '/default-avatar.png', '/wp.jpg', '#4cd8b8', FALSE, 'active')
           RETURNING *"#
    )
    .bind(&payload.username)
    .bind(&payload.nickname)
    .bind(hashed_password)
    .fetch_one(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "创建用户失败".to_string()))?;

    // 生成 JWT token
    let token = generate_token(user.user_id)?;

    let response = AuthResponse {
        token,
        user: UserResponse {
            user_id: user.user_id,
            username: user.username,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            background_url: user.background_url,
            theme_color: user.theme_color,
            is_admin: user.is_admin,
        },
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// 处理用户登录
#[debug_handler]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, String)> {
    // 查找用户
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?"
    )
    .bind(&payload.username)
    .fetch_optional(state.db.pool())
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "数据库查询失败".to_string()))?
    .ok_or((StatusCode::UNAUTHORIZED, "用户名或密码错误".to_string()))?;

    // 验证密码
    let valid = verify(&payload.password, &user.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "密码验证失败".to_string()))?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "用户名或密码错误".to_string()));
    }

    // 生成 JWT token
    let token = generate_token(user.user_id)?;

    let response = AuthResponse {
        token,
        user: UserResponse {
            user_id: user.user_id,
            username: user.username,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            background_url: user.background_url,
            theme_color: user.theme_color,
            is_admin: user.is_admin,
        },
    };

    Ok((StatusCode::OK, Json(response)))
}

/// 生成 JWT token
fn generate_token(user_id: i32) -> Result<String, (StatusCode, String)> {
    // 获取 JWT secret (默认值或环境变量)
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "default_jwt_secret".to_string());
    
    // 设置过期时间为 24 小时
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "时间计算错误".to_string()))?
        .as_secs() as usize + 24 * 60 * 60;

    let claims = Claims {
        sub: user_id,
        exp: expiration,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Token 生成失败".to_string()))
}