//! 数据库模块
//! 处理数据库连接和操作

use sqlx::mysql::MySqlPool;
use anyhow::Result;

/// 数据库结构体
/// 包装数据库连接池
#[derive(Clone)]
pub struct Database {
    pool: MySqlPool,
}

impl Database {
    /// 创建新的数据库连接
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = MySqlPool::connect(database_url).await?;
        Ok(Self { pool })
    }

    /// 获取数据库连接池
    pub fn pool(&self) -> &MySqlPool {
        &self.pool
    }
}