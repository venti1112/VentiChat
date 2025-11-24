//! VentiChat - 一个基于 Rust 的聊天系统
//!
//! 这是一个功能丰富的聊天系统，包括：
//! - 用户注册和登录
//! - 聊天室管理
//! - 消息发送和接收
//! - 文件上传
//! - 权限管理

use anyhow::Result;
use axum::{
    routing::{get, post, delete, put},
    Router,
};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing_subscriber;
use tower_http::services::ServeDir;

mod db;
mod models;
mod config;
mod init;
mod controllers;
mod middleware;
mod utils;
mod websocket;

// 引入库中的公共类型
use crate::{AppState, db::Database, init::{initialize_database, create_admin_user}};

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::fmt::init();

    // 加载配置
    let config = match config::Config::from_env() {
        Ok(config) => config,
        Err(_) => {
            tracing::warn!("未找到环境变量配置，使用默认配置");
            config::Config {
                database_url: "mysql://root:password@localhost/ventichat".to_string(),
                host: "127.0.0.1".to_string(),
                port: 3000,
                encryption_key: "default_encryption_key".to_string(),
                jwt_secret: "default_jwt_secret".to_string(),
            }
        }
    };

    let database = Database::new(&config.database_url).await?;
    let state = AppState { db: database };

    // 初始化数据库
    initialize_database(&state.db).await?;

    // 创建管理员
    if let (Ok(admin_username), Ok(admin_password)) = (
    std::env::var("ADMIN_USERNAME"),
    std::env::var("ADMIN_PASSWORD")
    ) {
        create_admin_user(&state.db, &admin_username, &admin_password).await?;
    }

    // 启动清理任务
    utils::cleanup::start_cleanup_scheduler(state.db.clone()).await;

    // 构建我们的应用路由
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/api/auth/register", post(controllers::auth::register))
        .route("/api/auth/login", post(controllers::auth::login))
        .route("/api/users/me", get(controllers::user::get_current_user))
        .route("/api/users/me", post(controllers::user::update_current_user))
        // 聊天室相关路由
        .route("/api/rooms", post(controllers::room::create_room))
        .route("/api/rooms", get(controllers::room::get_user_rooms))
        .route("/api/rooms/:room_id", get(controllers::room::get_room))
        .route("/api/rooms/:room_id", put(controllers::room::update_room))
        .route("/api/rooms/:room_id", delete(controllers::room::delete_room))
        .route("/api/rooms/:room_id/join", post(controllers::room::request_join_room))
        .route("/api/rooms/:room_id/members", get(controllers::room::get_room_members))
        .route("/api/rooms/:room_id/leave", post(controllers::room::leave_room))
        // 聊天室管理相关路由
        .route("/api/rooms/:room_id/members/:user_id", post(controllers::room_admin::add_member))
        .route("/api/rooms/:room_id/members/:user_id", delete(controllers::room_admin::remove_member))
        .route("/api/rooms/:room_id/members/:user_id/moderator", post(controllers::room_admin::set_moderator))
        .route("/api/rooms/:room_id/requests", get(controllers::room_admin::get_join_requests))
        .route("/api/rooms/:room_id/requests/:request_id", post(controllers::room_admin::handle_join_request))
        // 消息相关路由
        .route("/api/rooms/:room_id/messages", post(controllers::message::send_message))
        .route("/api/rooms/:room_id/messages", get(controllers::message::get_messages))
        .route("/api/rooms/:room_id/messages/:message_id", delete(controllers::message::recall_message))
        // 文件上传路由
        .route("/api/upload", post(utils::file_upload::upload_file))
        .route("/api/files/:file_name", get(utils::file_upload::get_file_info))
        // 管理后台路由
        .route("/api/admin/settings", get(controllers::admin::get_system_settings))
        .route("/api/admin/settings", put(controllers::admin::update_system_settings))
        .route("/api/admin/users", get(controllers::admin::get_all_users))
        .route("/api/admin/users/:user_id", get(controllers::admin::get_user))
        .route("/api/admin/users/:user_id/status", put(controllers::admin::update_user_status))
        .route("/api/admin/users/:user_id", delete(controllers::admin::delete_user))
        .route("/api/admin/users/:user_id/password", put(controllers::admin::reset_user_password))
        .route("/api/admin/rooms", get(controllers::admin::get_all_rooms))
        .route("/api/admin/rooms/:room_id", delete(controllers::admin::delete_room))
        // WebSocket 路由
        .route("/ws", get(websocket::websocket_handler))
        // 静态文件服务
        .nest_service("/uploads", ServeDir::new("uploads"))
        .nest_service("/public", ServeDir::new("public"))
        // 添加认证中间件到需要保护的路由
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth,
        ))
        .with_state(state);

    // 定义服务器地址
    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    tracing::info!("Starting server on {}", addr);

    // 绑定 TCP 监听器
    let listener = TcpListener::bind(addr).await?;
    
    // 启动服务器
    axum::serve(listener, app).await?;

    Ok(())
}

/// 根路径处理器，返回简单的欢迎信息
async fn root() -> &'static str {
    "Welcome to VentiChat Server!"
}

/// 健康检查端点
async fn health_check() -> &'static str {
    "OK"
}