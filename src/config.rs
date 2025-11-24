//! 配置模块
//! 处理应用程序配置

use serde::Deserialize;
use std::env;

/// 应用程序配置
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// 数据库连接 URL
    pub database_url: String,
    /// 服务器主机地址
    pub host: String,
    /// 服务器端口
    pub port: u16,
    /// 加密密钥
    pub encryption_key: String,
    /// JWT 密钥
    pub jwt_secret: String,
}

impl Config {
    /// 从环境变量加载配置
    pub fn from_env() -> Result<Self, envy::Error> {
        envy::from_env()
    }

    /// 获取服务器地址
    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}