//! 初始化模块
//! 处理数据库初始化和管理员账户创建

use anyhow::Result;
use bcrypt::{hash, DEFAULT_COST};
use sqlx::{MySqlPool, Row};
use std::env;

/// 初始化数据库结构
pub async fn initialize_database(pool: &MySqlPool) -> Result<()> {
    // 创建用户表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            user_id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            nickname VARCHAR(50) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            avatar_url VARCHAR(255) DEFAULT '/default-avatar.png',
            background_url VARCHAR(255) DEFAULT '/wp.jpg',
            theme_color VARCHAR(7) DEFAULT '#4cd8b8',
            is_admin BOOLEAN DEFAULT FALSE,
            status ENUM('active', 'banned') DEFAULT 'active',
            login_attempts INT DEFAULT 0,
            last_login_attempt TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建聊天室表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS rooms (
            room_id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            creator_id INT NOT NULL,
            is_private BOOLEAN DEFAULT FALSE,
            require_approval BOOLEAN DEFAULT TRUE,
            allow_images BOOLEAN DEFAULT TRUE,
            allow_videos BOOLEAN DEFAULT TRUE,
            allow_files BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建聊天室成员表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS room_members (
            user_id INT NOT NULL,
            room_id INT NOT NULL,
            is_moderator BOOLEAN DEFAULT FALSE,
            note VARCHAR(100) NULL,
            last_read_message_id INT DEFAULT 0,
            join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, room_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建消息表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            message_id INT PRIMARY KEY AUTO_INCREMENT,
            room_id INT NOT NULL,
            user_id INT NOT NULL,
            content TEXT,
            type ENUM('text', 'image', 'video', 'file') DEFAULT 'text',
            file_url VARCHAR(255) NULL,
            file_size INT DEFAULT 0,
            is_deleted BOOLEAN DEFAULT FALSE,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建加入请求表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS join_requests (
            request_id INT PRIMARY KEY AUTO_INCREMENT,
            status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
            request_message VARCHAR(255) NULL,
            user_id INT NOT NULL,
            room_id INT NOT NULL,
            request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建令牌表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tokens (
            token_str VARCHAR(255) PRIMARY KEY,
            user_id INT NOT NULL,
            expires_at DATETIME NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 创建系统设置表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_id INT PRIMARY KEY AUTO_INCREMENT,
            message_retention_days INT DEFAULT 180,
            max_file_size INT DEFAULT 10485760,
            site_name VARCHAR(255) DEFAULT 'VentiChat',
            allow_user_registration BOOLEAN DEFAULT TRUE,
            max_login_attempts INT DEFAULT 5,
            login_lock_time INT DEFAULT 120,
            max_room_members INT DEFAULT 1000
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 插入默认系统设置
    let setting_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM system_settings")
        .fetch_one(pool)
        .await?;
        
    if setting_exists == 0 {
        sqlx::query(
            r#"
            INSERT INTO system_settings (
                message_retention_days, max_file_size, site_name, 
                allow_user_registration, max_login_attempts, 
                login_lock_time, max_room_members
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(180)           // message_retention_days
        .bind(10485760)      // max_file_size (10MB)
        .bind("VentiChat")   // site_name
        .bind(true)          // allow_user_registration
        .bind(5)             // max_login_attempts
        .bind(120)           // login_lock_time
        .bind(1000)          // max_room_members
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// 创建默认管理员账户
pub async fn create_admin_user(pool: &MySqlPool, admin_username: &str, admin_password: &str) -> Result<()> {
    // 检查是否已经存在管理员账户
    let admin_exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_admin = TRUE")
        .fetch_one(pool)
        .await?;

    if admin_exists == 0 {
        let hashed_password = hash(admin_password, DEFAULT_COST)?;
        
        sqlx::query(
            r#"
            INSERT INTO users (
                username, nickname, password_hash, 
                avatar_url, background_url, theme_color, 
                is_admin, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(admin_username)
        .bind(admin_username)  // 使用用户名作为默认昵称
        .bind(hashed_password)
        .bind("/default-avatar.png")
        .bind("/wp.jpg")
        .bind("#4cd8b8")
        .bind(true)  // is_admin
        .bind("active")  // status
        .execute(pool)
        .await?;

        tracing::info!("默认管理员账户创建成功: {}", admin_username);
    } else {
        tracing::info!("管理员账户已存在，跳过创建");
    }

    Ok(())
}