pub mod db;
pub mod models;
pub mod controllers;
pub mod utils;
pub mod config;
pub mod init;
pub mod websocket;
pub mod middleware;

pub use db::Database;
pub use config::Config;
pub use init::{initialize_database, create_admin_user};

#[derive(Clone)]
pub struct AppState {
    pub db: db::Database,
}
