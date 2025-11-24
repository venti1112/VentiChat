//! 中间件模块
//! 处理身份验证和其他中间件功能

use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::Deserialize;
use std::env;

use venti_chat::AppState;
use crate::models::User;

/// JWT Claims 结构
#[derive(Deserialize)]
struct Claims {
    sub: i32, // 用户ID
    exp: usize, // 过期时间
}

/// 认证中间件
/// 验证请求中的 JWT token 并提取用户信息
pub async fn auth(
    State(state): State<AppState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // 从 Authorization header 中获取 token
    let auth_header = req.headers()
        .get("authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 获取 JWT secret (默认值或环境变量)
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "default_jwt_secret".to_string());

    // 解码 token
    let token_data = decode::<Claims>(
        auth_header,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // 从数据库获取用户信息
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(token_data.claims.sub)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 将用户信息插入请求扩展中，供后续处理器使用
    let mut req = req;
    req.extensions_mut().insert(user);
    
    Ok(next.run(req).await)
}