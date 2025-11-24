//! WebSocket 模块
//! 处理实时通信功能

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State, Query,
    },
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

use venti_chat::AppState;
use crate::models::User;

/// WebSocket 消息类型
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    /// 加入房间消息
    JoinRoom { room_id: i32 },
    
    /// 离开房间消息
    LeaveRoom { room_id: i32 },
    
    /// 聊天消息
    ChatMessage { 
        room_id: i32, 
        content: String,
        message_type: String, // text, image, video, file
        file_url: Option<String>,
    },
    
    /// 用户状态消息
    UserStatus { 
        user_id: i32, 
        status: String // online, offline
    },
    
    /// 错误消息
    Error { 
        message: String 
    },
    
    /// 成功消息
    Success { 
        message: String 
    }
}

/// 房间连接信息
#[derive(Debug, Clone)]
pub struct RoomConnection {
    pub user_id: i32,
    pub username: String,
    pub nickname: String,
    pub sender: broadcast::Sender<WebSocketMessage>,
}

/// 全局 WebSocket 状态
pub type WebSocketState = Arc<Mutex<HashMap<i32, HashMap<i32, RoomConnection>>>>;

/// WebSocket 查询参数
#[derive(Deserialize)]
pub struct WebSocketQuery {
    pub token: String,
}

/// WebSocket 升级处理函数
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WebSocketQuery>,
) -> Response {
    // 验证 JWT token
    let user = match validate_token(&state, &query.token).await {
        Ok(user) => user,
        Err(_) => return ws.on_upgrade(|_| async {}), // 无效token直接关闭连接
    };
    
    ws.on_upgrade(move |socket| websocket_connection(socket, state, user))
}

/// 验证 JWT token 并获取用户信息
async fn validate_token(state: &AppState, token: &str) -> Result<User, ()> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
    use std::env;

    // 获取 JWT secret
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "default_jwt_secret".to_string());

    // 解码 token
    let token_data = decode::<std::collections::HashMap<String, serde_json::Value>>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    ).map_err(|_| ())?;

    let user_id = token_data.claims.get("sub")
        .and_then(|v| v.as_i64())
        .ok_or(())? as i32;

    // 从数据库获取用户信息
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(state.db.pool())
        .await
        .map_err(|_| ())?
        .ok_or(())?;

    Ok(user)
}

/// WebSocket 连接处理函数
async fn websocket_connection(socket: WebSocket, state: AppState, user: User) {
    let (mut sender, mut receiver) = socket.split();
    
    // 为每个用户创建广播通道
    let (tx, mut rx) = broadcast::channel::<WebSocketMessage>(100);
    
    // 克隆发送者用于转发消息
    let send_tx = tx.clone();
    
    // 处理从客户端接收的消息
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                match serde_json::from_str::<WebSocketMessage>(&text) {
                    Ok(ws_msg) => {
                        if let Err(e) = handle_websocket_message(&state, &user, ws_msg, &send_tx).await {
                            tracing::error!("处理 WebSocket 消息失败: {}", e);
                        }
                    }
                    Err(e) => {
                        tracing::error!("解析 WebSocket 消息失败: {}", e);
                    }
                }
            }
        }
    });
    
    // 处理向客户端发送消息
    let mut send_task = tokio::spawn(async move {
        while let Ok(ws_msg) = rx.recv().await {
            if let Ok(json_msg) = serde_json::to_string(&ws_msg) {
                if sender.send(Message::Text(json_msg)).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // 等待任一任务完成
    tokio::select! {
        _ = &mut recv_task => (),
        _ = &mut send_task => (),
    }
}

/// 处理 WebSocket 消息
async fn handle_websocket_message(
    state: &AppState,
    user: &User,
    message: WebSocketMessage,
    sender: &broadcast::Sender<WebSocketMessage>,
) -> Result<(), anyhow::Error> {
    match message {
        WebSocketMessage::JoinRoom { room_id } => {
            handle_join_room(state, user, room_id, sender.clone()).await?;
        }
        WebSocketMessage::LeaveRoom { room_id } => {
            handle_leave_room(state, user, room_id).await?;
        }
        WebSocketMessage::ChatMessage { 
            room_id, 
            content,
            message_type,
            file_url
        } => {
            handle_chat_message(state, user, room_id, content, message_type, file_url).await?;
        }
        _ => {
            tracing::warn!("未处理的 WebSocket 消息类型");
        }
    }
    
    Ok(())
}

/// 处理加入房间消息
async fn handle_join_room(
    state: &AppState,
    user: &User,
    room_id: i32,
    sender: broadcast::Sender<WebSocketMessage>,
) -> Result<(), anyhow::Error> {
    // 检查用户是否是聊天室成员
    let member = sqlx::query("SELECT * FROM room_members WHERE user_id = ? AND room_id = ?")
        .bind(user.user_id)
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await?;
        
    if member.is_none() {
        // 发送错误消息给用户
        let _ = sender.send(WebSocketMessage::Error {
            message: "您不是该聊天室的成员".to_string(),
        });
        return Ok(());
    }
    
    // 在实际应用中，我们需要将用户添加到房间的连接列表中
    // 这里简化处理，直接发送成功消息
    let _ = sender.send(WebSocketMessage::Success {
        message: "成功加入房间".to_string(),
    });
    
    tracing::info!("用户 {} 加入房间 {}", user.user_id, room_id);
    Ok(())
}

/// 处理离开房间消息
async fn handle_leave_room(
    _state: &AppState,
    user: &User,
    room_id: i32,
) -> Result<(), anyhow::Error> {
    tracing::info!("用户 {} 离开房间 {}", user.user_id, room_id);
    Ok(())
}

/// 处理聊天消息
async fn handle_chat_message(
    state: &AppState,
    user: &User,
    room_id: i32,
    content: String,
    message_type: String,
    file_url: Option<String>,
) -> Result<(), anyhow::Error> {
    // 检查用户是否是聊天室成员
    let member = sqlx::query("SELECT * FROM room_members WHERE user_id = ? AND room_id = ?")
        .bind(user.user_id)
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await?;
        
    if member.is_none() {
        tracing::warn!("用户 {} 不是房间 {} 的成员，无法发送消息", user.user_id, room_id);
        return Ok(());
    }
    
    // 检查聊天室是否存在
    let room = sqlx::query("SELECT * FROM rooms WHERE room_id = ?")
        .bind(room_id)
        .fetch_optional(state.db.pool())
        .await?;
        
    if room.is_none() {
        tracing::warn!("房间 {} 不存在", room_id);
        return Ok(());
    }
    
    // 保存消息到数据库
    sqlx::query(
        "INSERT INTO messages (room_id, user_id, content, type, file_url) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(room_id)
    .bind(user.user_id)
    .bind(&content)
    .bind(&message_type)
    .bind(&file_url)
    .execute(state.db.pool())
    .await?;
    
    tracing::info!("用户 {} 在房间 {} 发送消息", user.user_id, room_id);
    Ok(())
}