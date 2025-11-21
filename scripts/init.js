const inquirer = require('inquirer').default;
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log } = require('../utils/logger');

async function init() {
    try {
        const questions = [
            { type: 'input', name: 'dbHost', message: 'MySQL主机地址:', default: 'localhost' },
            { type: 'input', name: 'dbPort', message: 'MySQL端口:', default: '3306' },
            { type: 'input', name: 'dbUser', message: 'MySQL用户名:', default: 'root' },
            { type: 'password', name: 'dbPassword', message: 'MySQL密码:' },
            { type: 'input', name: 'dbName', message: '数据库名称:', default: 'ventichat' },
            { type: 'input', name: 'adminUsername', message: '管理员用户名:' },
            { type: 'password', name: 'adminPassword', message: '管理员密码:' },
            { type: 'input', name: 'baseUrl', message: '基础URL:', default: 'http://localhost' },
            { type: 'input', name: 'port', message: '服务端口:', default: '3011' }
        ];

        const answers = await inquirer.prompt(questions);

        // 生成加密密钥
        const encryptionKey = crypto.randomBytes(32).toString('hex');

        // 创建数据库连接
        const connection = await mysql.createConnection({
            host: answers.dbHost,
            port: answers.dbPort,
            user: answers.dbUser,
            password: answers.dbPassword
        });

        // 检查并删除同名数据库（如果存在）
        await connection.query(`DROP DATABASE IF EXISTS \`${answers.dbName}\`;`);
        log('INFO', `已删除现有数据库 ${answers.dbName}（如果存在）`);

        // 创建新数据库
        await connection.query(`CREATE DATABASE \`${answers.dbName}\`;`);
        log('INFO', `已创建新数据库 ${answers.dbName}`);

        await connection.changeUser({ database: answers.dbName });

        // 创建用户表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                nickname VARCHAR(50) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(255),
                status ENUM('active', 'banned') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // 创建聊天室表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                creator_id INT NOT NULL,
                is_private BOOLEAN DEFAULT false,
                require_approval BOOLEAN DEFAULT true,
                allow_images BOOLEAN DEFAULT true,
                allow_videos BOOLEAN DEFAULT true,
                allow_files BOOLEAN DEFAULT true,
                retention_days INT DEFAULT 180,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 创建成员关系表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS room_members (
                user_id INT NOT NULL,
                room_id INT NOT NULL,
                is_moderator BOOLEAN DEFAULT false,
                join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                note VARCHAR(100),
                last_read_message_id INT DEFAULT 0,
                PRIMARY KEY (user_id, room_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 创建消息表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                room_id INT NOT NULL,
                sender_id INT NOT NULL,
                content TEXT,
                type ENUM('text', 'image', 'video', 'file') DEFAULT 'text',
                file_url VARCHAR(255),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT false,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 创建加入请求表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS JoinRequests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                message VARCHAR(255),
                user_id INT NOT NULL,
                room_id INT NOT NULL,
                request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 创建token表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tokens (
                token_str VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 创建默认管理员
        const hashedPassword = bcrypt.hashSync(answers.adminPassword, 10);
        await connection.query(
            `INSERT INTO users (username, nickname, password_hash, status) 
             VALUES (?, ?, ?, 'active')`,
            [answers.adminUsername, answers.adminUsername, hashedPassword]
        );

        // 创建默认大聊天室
        const [admin] = await connection.query('SELECT id FROM users WHERE username = ?', [answers.adminUsername]);
        await connection.query(
            `INSERT INTO rooms (name, creator_id, is_private, require_approval, retention_days) 
             VALUES ('VentiChat大厅', ?, false, false, 180)`,
            [admin[0].id]
        );

        // 获取大厅房间的ID
        const [hall] = await connection.query('SELECT id FROM rooms WHERE name = ?', ['VentiChat大厅']);
        
        // 将管理员加入大厅房间（仅管理员）
        await connection.query(
            `INSERT INTO room_members (user_id, room_id, is_moderator) 
             VALUES (?, ?, true)`,
            [admin[0].id, hall[0].id]
        );

        // 保存配置
        const config = {
            db: {
                host: answers.dbHost,
                port: answers.dbPort,
                user: answers.dbUser,
                password: answers.dbPassword,
                database: answers.dbName
            },
            encryptionKey,
            baseUrl: answers.baseUrl,
            port: answers.port,
            adminUsername: answers.adminUsername
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
        log('INFO', '请运行 `npm start` 启动服务');
        process.exit(0);
    } catch (error) {
        log('ERROR', `初始化失败: ${error.message}`);
        process.exit(1);
    }
}

init();