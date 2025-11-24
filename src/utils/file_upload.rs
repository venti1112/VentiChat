//! 文件上传工具模块
//! 处理文件上传、存储和管理功能

use venti_chat::AppState;
use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::Json,
    debug_handler,
};
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use std::fs;
use uuid::Uuid;

/// 文件上传响应
#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub size: u64,
}

/// 处理文件上传
#[debug_handler]
pub async fn upload_file(
    State(_state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    // 创建上传目录
    let upload_dir = "uploads";
    if !Path::new(upload_dir).exists() {
        fs::create_dir_all(upload_dir)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "创建上传目录失败".to_string()))?;
    }

    // 处理上传的文件
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| (StatusCode::BAD_REQUEST, "解析上传文件失败".to_string()))?
    {
        let _name = field.name().unwrap_or("file").to_string();
        let file_name = field
            .file_name()
            .map(|f| f.to_string())
            .unwrap_or_else(|| "unnamed_file".to_string());
        
        // 生成唯一文件名
        let extension = Path::new(&file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        
        let unique_name = format!("{}_{}.{}", 
            Uuid::new_v4().to_string(),
            chrono::Utc::now().timestamp(),
            extension
        );
        
        let file_path = format!("{}/{}", upload_dir, unique_name);
        
        // 读取文件内容
        let data = field
            .bytes()
            .await
            .map_err(|_| (StatusCode::BAD_REQUEST, "读取文件内容失败".to_string()))?;
        
        // 保存文件
        let mut file = fs::File::create(&file_path)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "创建文件失败".to_string()))?;
        
        file.write_all(&data)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "写入文件失败".to_string()))?;
        
        // 获取文件大小
        let size = data.len() as u64;
        
        // 返回文件URL
        let url = format!("/{}", file_path);
        let response = UploadResponse { url, size };
        
        return Ok(Json(response));
    }

    Err((StatusCode::BAD_REQUEST, "没有上传文件".to_string()))
}

/// 获取文件信息
#[debug_handler]
pub async fn get_file_info(
    State(_state): State<AppState>,
    axum::extract::Path(file_name): axum::extract::Path<String>,
) -> Result<Json<std::collections::HashMap<String, String>>, (StatusCode, String)> {
    let file_path = format!("uploads/{}", file_name);
    
    // 检查文件是否存在
    if !Path::new(&file_path).exists() {
        return Err((StatusCode::NOT_FOUND, "文件不存在".to_string()));
    }
    
    // 获取文件元数据
    let metadata = fs::metadata(&file_path)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "获取文件信息失败".to_string()))?;
    
    let mut info = std::collections::HashMap::new();
    info.insert("name".to_string(), file_name);
    info.insert("size".to_string(), metadata.len().to_string());
    info.insert("modified".to_string(), 
        metadata.modified()
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "获取文件修改时间失败".to_string()))?
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "时间计算失败".to_string()))?
            .as_secs()
            .to_string()
    );
    
    Ok(Json(info))
}