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
            { type: 'input', name: 'redisHost', message: 'Redis主机地址:', default: 'localhost' },
            { type: 'input', name: 'redisPort', message: 'Redis端口:', default: '6379' },
            { type: 'password', name: 'redisPassword', message: 'Redis密码 (留空表示无密码):' },
            { type: 'input', name: 'adminUsername', message: '管理员用户名:' },
            { type: 'password', name: 'adminPassword', message: '管理员密码:' },
            { type: 'input', name: 'baseUrl', message: '基础URL:', default: 'http://localhost' },
            { type: 'input', name: 'port', message: '服务端口:', default: '3011' },
            { type: 'input', name: 'workerCount', message: '工作进程数量 (0表示使用CPU核心数):', default: '0' }
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

        // 创建聊天室表
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

        // 创建成员关系表
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

        // 创建消息表
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

        // 创建加入请求表
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

        // 创建系统设置表
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

        // 插入默认系统设置
        await connection.query(`
            INSERT INTO system_settings (
                setting_id, message_retention_days, max_file_size, site_name, 
                allow_user_registration, max_login_attempts, max_room_members, login_lock_time
            ) VALUES (1, 180, 10485760, 'VentiChat', true, 5, 1000, 30)
        `);

        // 创建默认管理员
        const hashedPassword = bcrypt.hashSync(answers.adminPassword, 10);
        await connection.query(
            `INSERT INTO users (
                username, nickname, password_hash, is_admin, status
            ) VALUES (?, ?, ?, true, 'active')`,
            [answers.adminUsername, answers.adminUsername, hashedPassword]
        );

        // 获取管理员ID
        const [adminRows] = await connection.query(
            'SELECT user_id FROM users WHERE username = ?', 
            [answers.adminUsername]
        );
        const adminId = adminRows[0].user_id;

        // 创建默认大聊天室
        await connection.query(
            `INSERT INTO rooms (
                name, creator_id, is_private, require_approval
            ) VALUES (?, ?, false, false)`,
            ['VentiChat大厅', adminId]
        );

        // 获取大厅房间的ID
        const [hallRows] = await connection.query(
            'SELECT room_id FROM rooms WHERE name = ?', 
            ['VentiChat大厅']
        );
        const hallId = hallRows[0].room_id;

        // 将管理员加入大厅房间（作为管理员）
        await connection.query(
            `INSERT INTO room_members (user_id, room_id, is_moderator) VALUES (?, ?, true)`,
            [adminId, hallId]
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
            redis: {
                host: answers.redisHost,
                port: answers.redisPort,
                password: answers.redisPassword || null
            },
            encryptionKey,
            baseUrl: answers.baseUrl,
            port: answers.port,
            logLevel: 2,
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
        log('INFO', '请运行 `npm start` 启动服务');
        process.exit(0);
    } catch (error) {
        log('ERROR', `初始化失败: ${error.message}`);
        process.exit(1);
    }
}

init();