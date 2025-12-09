const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log } = require('../utils/logger');

async function init() {
    const app = express();
    const port = 3012;

    app.use(express.json());
    app.use(express.static(path.join(__dirname)));

    // Serve the initialization page
    app.get('/', (req, res) => {
        // 添加禁止缓存的HTTP头
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.sendFile(path.join(__dirname, 'setup.html'));
    });

    // 处理初始化表单提交
    app.post('/setup', async (req, res) => {
        try {
            // 直接使用req.body而不是FormData
            const answers = req.body;
            
            // 发送响应头，准备流式传输
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // 发送初始状态
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在初始化数据库...' }) + '\n\n');

            // Generate encryption key
            const encryptionKey = crypto.randomBytes(32).toString('hex');

            // Create database connection
            const connection = await mysql.createConnection({
                host: answers.dbHost,
                port: answers.dbPort,
                user: answers.dbUser,
                password: answers.dbPassword
            });

            // Check and drop existing database (if exists)
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在删除现有数据库（如果存在）' }) + '\n\n');
            await connection.query(`DROP DATABASE IF EXISTS \`${answers.dbName}\`;`);
            log('INFO', `已删除现有数据库 ${answers.dbName}（如果存在）`);

            // Create new database
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建新数据库' }) + '\n\n');
            await connection.query(`CREATE DATABASE \`${answers.dbName}\`;`);
            log('INFO', `已创建新数据库 ${answers.dbName}`);

            await connection.changeUser({ database: answers.dbName });

            // Create users table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建用户表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS users (
                    user_id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    nickname VARCHAR(50) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    avatar_url VARCHAR(255) DEFAULT '/default-avatar.png',
                    background_url VARCHAR(255) DEFAULT '/wp.jpg',
                    theme_color VARCHAR(7) DEFAULT '#4cd8b8',
                    is_admin BOOLEAN DEFAULT false,
                    status ENUM('active', 'banned') DEFAULT 'active',
                    login_attempts INT DEFAULT 0,
                    last_login_attempt TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `);


            // Create rooms table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建房间表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS rooms (
                    room_id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    creator_id INT NOT NULL,
                    is_private BOOLEAN DEFAULT false,
                    require_approval BOOLEAN DEFAULT true,
                    allow_images BOOLEAN DEFAULT true,
                    allow_videos BOOLEAN DEFAULT true,
                    allow_files BOOLEAN DEFAULT true,
                    allow_audio BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `);

            // Create room members table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建房间成员表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS room_members (
                    user_id INT NOT NULL,
                    room_id INT NOT NULL,
                    is_moderator BOOLEAN DEFAULT false,
                    note VARCHAR(100),
                    last_read_message_id INT DEFAULT 0,
                    join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, room_id)
                ) ENGINE=InnoDB;
            `);

            // Create messages table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建消息表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    message_id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    user_id INT NOT NULL,
                    content TEXT,
                    type ENUM('text', 'image', 'video', 'file', 'audio') DEFAULT 'text',
                    file_url VARCHAR(255),
                    file_size INT DEFAULT 0,
                    is_deleted BOOLEAN DEFAULT false,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `);

            // Create join requests table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建加入聊天室请求表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS join_requests (
                    request_id INT AUTO_INCREMENT PRIMARY KEY,
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    request_message VARCHAR(255),
                    user_id INT NOT NULL,
                    room_id INT NOT NULL,
                    request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `);

            // Create system settings table
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建系统设置表' }) + '\n\n');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    setting_id INT AUTO_INCREMENT PRIMARY KEY,
                    message_retention_days INT DEFAULT 180,
                    max_file_size INT DEFAULT 10485760,
                    site_name VARCHAR(255) DEFAULT 'VentiChat',
                    allow_user_registration BOOLEAN DEFAULT true,
                    max_login_attempts INT DEFAULT 5,
                    max_room_members INT DEFAULT 1000,
                    login_lock_time INT DEFAULT 30
                ) ENGINE=InnoDB;
            `);

            // Insert default system settings
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在配置系统设置' }) + '\n\n');
            await connection.query(`
                INSERT INTO system_settings (
                    setting_id, message_retention_days, max_file_size, site_name, 
                    allow_user_registration, max_login_attempts, max_room_members, login_lock_time
                ) VALUES (1, 180, 10485760, 'VentiChat', true, 5, 1000, 30)
            `);

            // Create default admin user
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建默认管理员用户' }) + '\n\n');
            const hashedPassword = bcrypt.hashSync(answers.adminPassword, 10);
            await connection.query(
                `INSERT INTO users (
                    username, nickname, password_hash, is_admin, status
                ) VALUES (?, ?, ?, true, 'active')`,
                [answers.adminUsername, answers.adminUsername, hashedPassword]
            );
            

            // Get admin user ID
            const [adminRows] = await connection.query(
                'SELECT user_id FROM users WHERE username = ?', 
                [answers.adminUsername]
            );
            const adminId = adminRows[0].user_id;

            // Create default main room
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在创建默认房间' }) + '\n\n');
            await connection.query(
                `INSERT INTO rooms (
                    name, creator_id, is_private, require_approval
                ) VALUES (?, ?, false, false)`,
                ['VentiChat大厅', adminId]
            );
            

            // Get main room ID
            const [hallRows] = await connection.query(
                'SELECT room_id FROM rooms WHERE name = ?', 
                ['VentiChat大厅']
            );
            const hallId = hallRows[0].room_id;

            // Add admin user to main room (as moderator)
            res.write('data: ' + JSON.stringify({status: 'initializing', message: '正在添加管理员到默认房间' }) + '\n\n');
            await connection.query(
                `INSERT INTO room_members (user_id, room_id, is_moderator) VALUES (?, ?, true)`,
                [adminId, hallId]
            );

            // Save configuration
            const config = {
                db: {
                    host: answers.dbHost,
                    port: answers.dbPort,
                    user: answers.dbUser,
                    password: answers.dbPassword,
                    database: answers.dbName
                },
                redis: {
                    host: answers.redisHost,
                    port: answers.redisPort,
                    password: answers.redisPassword || null
                },
                encryptionKey,
                baseUrl: answers.baseUrl,
                port: answers.port,
                logLevel: answers.logLevel || "INFO",
                workerCount: parseInt(answers.workerCount, 10) || 0
            };

            const configDir = path.join(__dirname, '../config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(configDir, 'config.json'),
                JSON.stringify(config, null, 2)
            );

            log('INFO', '初始化完成！配置文件已保存到 config/config.json');
            
            // Send completion message and exit immediately
            res.write('data: ' + JSON.stringify({status: 'completed', message: '初始化完成！正在启动主服务...', redirectUrl: answers.baseUrl }) + '\n\n');
            res.end();
            
            // Exit the setup script immediately
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        } catch (error) {
            log('ERROR', `初始化失败: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    error: `初始化失败: ${error.message}` 
                });
            } else {
                res.write('data: ' + JSON.stringify({status: 'error', message: `初始化失败: ${error.message}` }) + '\n\n');
                res.end();
            }
            // Exit even on error
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        }
    });

    const server = app.listen(port, () => {
        log('INFO', `初始化服务器已在端口 ${port} 上启动，请访问以进行初始化！`);
    });
}

init();