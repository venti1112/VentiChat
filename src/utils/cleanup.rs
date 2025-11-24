//! 清理工具模块
//! 处理过期消息和文件的定时清理任务

use crate::db::Database;
use sqlx::Row;
use std::path::Path;
use std::fs;
use tracing::info;

/// 清理过期消息和文件
pub async fn cleanup_expired_data(db: &Database) -> Result<(), anyhow::Error> {
    info!("开始执行清理任务");
    
    // 获取系统设置中的消息保留天数
    let retention_days: i32 = sqlx::query_scalar(
        "SELECT message_retention_days FROM system_settings LIMIT 1"
    )
    .fetch_one(db.pool())
    .await
    .unwrap_or(180); // 默认180天
    
    // 计算过期时间
    let expired_time = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
    
    // 查找过期的消息
    let expired_messages = sqlx::query(
        "SELECT message_id, type, file_url FROM messages WHERE sent_at < ?"
    )
    .bind(expired_time)
    .fetch_all(db.pool())
    .await?;
    
    info!("找到 {} 条过期消息", expired_messages.len());
    
    // 删除过期消息相关的文件
    for row in &expired_messages {
        let message_type: String = row.try_get("type")?;
        let file_url: Option<String> = row.try_get("file_url")?;
        
        // 如果是文件类型消息且有文件URL，则尝试删除文件
        if (message_type == "image" || message_type == "video" || message_type == "file") 
            && file_url.is_some() {
            let url = file_url.unwrap();
            // 提取文件路径（去除前导斜杠）
            if url.starts_with('/') {
                let file_path = &url[1..];
                if Path::new(file_path).exists() {
                    match fs::remove_file(file_path) {
                        Ok(_) => info!("已删除文件: {}", file_path),
                        Err(e) => info!("删除文件失败 {}: {}", file_path, e),
                    }
                }
            }
        }
    }
    
    // 从数据库中删除过期消息
    if !expired_messages.is_empty() {
        let expired_ids: Vec<i32> = expired_messages.iter()
            .map(|row| row.get("message_id"))
            .collect();
        
        // 构建 IN 查询语句
        let placeholders: Vec<String> = expired_ids.iter()
            .map(|_| "?".to_string())
            .collect();
        let placeholders_str = placeholders.join(",");
        
        let query_str = format!(
            "DELETE FROM messages WHERE message_id IN ({})",
            placeholders_str
        );
        
        let mut query = sqlx::query(&query_str);
        for id in &expired_ids {
            query = query.bind(id);
        }
        
        let deleted = query.execute(db.pool()).await?.rows_affected();
        info!("已从数据库删除 {} 条过期消息", deleted);
    }
    
    info!("清理任务完成");
    Ok(())
}

/// 启动定时清理任务
pub async fn start_cleanup_scheduler(db: Database) {
    tokio::spawn(async move {
        loop {
            // 每天凌晨4点执行清理任务
            let now = chrono::Local::now();
            let next_run = now.date_naive().and_hms_opt(4, 0, 0).unwrap();
            let next_run = if now.time() > chrono::NaiveTime::from_hms_opt(4, 0, 0).unwrap() {
                // 如果当前时间已经超过凌晨4点，则明天执行
                next_run + chrono::Duration::days(1)
            } else {
                // 否则今天执行
                next_run
            };
            
            let duration = next_run - now.naive_local();
            tokio::time::sleep(tokio::time::Duration::from_secs(
                duration.num_seconds() as u64
            )).await;
            
            // 执行清理任务
            if let Err(e) = cleanup_expired_data(&db).await {
                tracing::error!("清理任务执行失败: {}", e);
            }
        }
    });
}