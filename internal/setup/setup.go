package setup

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	
	"gopkg.in/gomail.v2"
)

// 全局变量用于通知安装完成
var (
	installationCompleted bool
	serverMutex          sync.Mutex
	httpServer           *http.Server
)

// Config 安装配置结构体
type Config struct {
	Server struct {
		Host string `yaml:"host"`
		Port int    `yaml:"port"`
		Level string `yaml:"level"`
		Name  string `yaml:"name"`
	} `yaml:"server"`

	Database struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Database string `yaml:"database"`
	} `yaml:"database"`

	Redis struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Password string `yaml:"password"`
	} `yaml:"redis"`

	Email struct {
		Enable   bool   `yaml:"enable"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Secure   bool   `yaml:"secure"`
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		From     string `yaml:"from"`
	} `yaml:"email"`

	JWT struct {
		Key        string `yaml:"key"`
		Expiration int    `yaml:"expiration"`
	} `yaml:"jwt"`

	IPBan struct {
		Number int `yaml:"number"`
		Time   int `yaml:"time"`
	} `yaml:"ipBan"`

	SendFrequency struct {
		Time   int `yaml:"time"`
		Number int `yaml:"number"`
	} `yaml:"sendFrequency"`
}

// AdminUser 管理员用户信息
type AdminUser struct {
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

// RunSetup 启动安装向导
func RunSetup() bool {
	fmt.Println("配置文件不存在，启动安装向导...")
	fmt.Println("请访问 http://localhost:3012 进行初始化配置")

	// 设置GIN为发布模式以关闭调试日志
	gin.SetMode(gin.ReleaseMode)
	
	r := gin.New()
	r.Use(gin.Recovery()) // 只使用恢复中间件，不使用日志中间件
	
	// 提供静态文件服务
	r.Static("/static", filepath.Join(getCurrentDir(), "internal", "setup", "public"))
	
	// 路由
	r.GET("/", showSetupForm)
	r.POST("/setup", handleSetup)
	r.POST("/test-mysql", testMySQLConnection)
	r.POST("/test-redis", testRedisConnection)
	r.POST("/test-email-connection", testEmailConnection)
	r.POST("/test-send-email", testSendEmail)
	
	// 启动服务器
	httpServer = &http.Server{
		Addr:    ":3012",
		Handler: r,
	}
	
	// 在goroutine中启动服务器
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("安装向导启动失败:", err)
		}
	}()
	
	// 等待安装完成
	for {
		time.Sleep(1 * time.Second)
		serverMutex.Lock()
		if installationCompleted {
			serverMutex.Unlock()
			break
		}
		serverMutex.Unlock()
	}
	
	// 关闭服务器
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("服务器关闭失败: %v", err)
	}
	
	fmt.Println("安装向导已完成，系统即将启动...")
	return true
}

// getCurrentDir 获取当前执行目录
func getCurrentDir() string {
	dir, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	return dir
}

// showSetupForm 显示安装表单
func showSetupForm(c *gin.Context) {
	// 直接提供静态文件
	c.File(filepath.Join(getCurrentDir(), "internal", "setup", "public", "index.html"))
}

// handleSetup 处理安装表单提交
func handleSetup(c *gin.Context) {
	var config Config
	
	// 解析表单数据
	config.Server.Host = c.PostForm("server_host")
	config.Server.Port, _ = parseInt(c.PostForm("server_port"))
	config.Server.Level = c.PostForm("server_level")
	config.Server.Name = c.PostForm("server_name")
	
	config.Database.Host = c.PostForm("db_host")
	config.Database.Port, _ = parseInt(c.PostForm("db_port"))
	config.Database.User = c.PostForm("db_user")
	config.Database.Password = c.PostForm("db_password")
	config.Database.Database = c.PostForm("db_name")
	
	config.Redis.Host = c.PostForm("redis_host")
	config.Redis.Port, _ = parseInt(c.PostForm("redis_port"))
	config.Redis.Password = c.PostForm("redis_password")
	
	enableEmail := c.PostForm("email_enable")
	config.Email.Enable = (enableEmail == "on" || enableEmail == "true")
	config.Email.Host = c.PostForm("email_host")
	config.Email.Port, _ = parseInt(c.PostForm("email_port"))
	emailSecure := c.PostForm("email_secure")
	config.Email.Secure = (emailSecure == "on" || emailSecure == "true")
	config.Email.User = c.PostForm("email_user")
	config.Email.Password = c.PostForm("email_password")
	config.Email.From = c.PostForm("email_from")
	
	// 自动生成JWT密钥
	jwtKey, err := generateJWTKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成JWT密钥失败: " + err.Error()})
		return
	}
	config.JWT.Key = jwtKey
	config.JWT.Expiration, _ = parseInt(c.PostForm("jwt_expiration"))
	
	config.IPBan.Number, _ = parseInt(c.PostForm("ip_ban_number"))
	config.IPBan.Time, _ = parseInt(c.PostForm("ip_ban_time"))
	
	config.SendFrequency.Time, _ = parseInt(c.PostForm("send_frequency_time"))
	config.SendFrequency.Number, _ = parseInt(c.PostForm("send_frequency_number"))
	
	// 获取管理员账户信息
	adminUser := AdminUser{
		Username: c.PostForm("admin_username"),
		Nickname: c.PostForm("admin_nickname"),
		Password: c.PostForm("admin_password"),
		Email:    c.PostForm("admin_email"),
	}
	
	// 保存配置文件
	err = saveConfig(config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置文件失败: " + err.Error()})
		return
	}
	
	// 创建数据库
	err = createDatabase(config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建数据库失败: " + err.Error()})
		return
	}
	
	// 创建管理员账户
	err = createAdminUser(config, adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建管理员账户失败: " + err.Error()})
		return
	}
	
	// 标记安装完成
	serverMutex.Lock()
	installationCompleted = true
	serverMutex.Unlock()
	
	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"port": config.Server.Port,
	})
}

// generateJWTKey 生成安全的JWT密钥
func generateJWTKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// parseInt 安全地解析整数
func parseInt(str string) (int, error) {
	if str == "" {
		return 0, nil
	}
	
	var result int
	_, err := fmt.Sscanf(str, "%d", &result)
	return result, err
}

// saveConfig 保存配置到文件
func saveConfig(config Config) error {
	data, err := yaml.Marshal(&config)
	if err != nil {
		return err
	}
	
	// 确保config目录存在
	configDir := filepath.Join(getCurrentDir(), "config")
	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		err = os.MkdirAll(configDir, 0755)
		if err != nil {
			return err
		}
	}
	
	// 写入配置文件
	configPath := filepath.Join(configDir, "config.yaml")
	return os.WriteFile(configPath, data, 0644)
}

// createDatabase 创建数据库和表
func createDatabase(config Config) error {
	// 构建不包含数据库名的DSN用于连接MySQL服务器
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=True&loc=Local",
		config.Database.User,
		config.Database.Password,
		config.Database.Host,
		config.Database.Port)
	
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("连接数据库服务器失败: %v", err)
	}
	
	// 删除已有的数据库（如果存在）
	dropSQL := fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", config.Database.Database)
	if err := db.Exec(dropSQL).Error; err != nil {
		return fmt.Errorf("删除已有数据库失败: %v", err)
	}
	
	// 创建新数据库
	createSQL := fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", config.Database.Database)
	if err := db.Exec(createSQL).Error; err != nil {
		return fmt.Errorf("创建数据库失败: %v", err)
	}
	
	// 连接到新创建的数据库并创建表
	dsnWithDB := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.Database.User,
		config.Database.Password,
		config.Database.Host,
		config.Database.Port,
		config.Database.Database)
	
	dbWithDB, err := gorm.Open(mysql.Open(dsnWithDB), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("连接到新数据库失败: %v", err)
	}
	
	// 定义表结构
	type User struct {
		ID                  uint64 `gorm:"primaryKey;autoIncrement"`
		Username            string `gorm:"type:varchar(50);uniqueIndex;not null"`
		Mobile              string `gorm:"type:varchar(20);uniqueIndex"`
		Email               string `gorm:"type:varchar(255);uniqueIndex"`
		Nickname            string `gorm:"type:varchar(100);not null"`
		PasswordHash        string `gorm:"type:varchar(255)"`
		IsAdmin             bool   `gorm:"type:boolean;default:false"`
		IsFreepass          bool   `gorm:"type:boolean;default:false"`
		EmailVerified       bool   `gorm:"type:boolean;default:false"`
		IsTotpEnabled       bool   `gorm:"type:boolean;default:false"`
		TotpSecret          string `gorm:"type:varchar(255)"`
		Introduction        string `gorm:"type:text"`
		IsBanned            bool   `gorm:"type:boolean;default:false"`
		BannedAt            *time.Time
		BannedReason        string
		BannedType          string `gorm:"type:enum('login','mute','permanent')"`
		BannedBy            *uint64
		BannedTexpires      *time.Time
		AvatarURL           string `gorm:"type:varchar(255);default:'/default/avatar.png'"`
		ThemeColor          string `gorm:"type:varchar(10);default:'#4cd8b8'"`
		BackgroundURL       string `gorm:"type:varchar(255);default:'/default/background.png'"`
		SoundURL            string `gorm:"type:varchar(255);default:'/default/sound.mp3'"`
		Language            string `gorm:"type:varchar(10);default:'zh-CN'"`
		IsEmailNotification bool   `gorm:"type:boolean;default:false"`
		IsDesktopNotification bool `gorm:"type:boolean;default:false"`
		IsEmailRemind       bool   `gorm:"type:boolean;default:true"`
		CreatedAt           time.Time
	}
	
	type Friend struct {
		ID        uint64 `gorm:"primaryKey;autoIncrement"`
		UserID    uint64 `gorm:"type:bigint unsigned;not null;index"`
		FriendID  uint64 `gorm:"type:bigint unsigned;not null;index"`
		Status    string `gorm:"type:enum('active','block');default:'active'"`
		Unread    int    `gorm:"type:int;not null;default:0"`
		CreatedAt time.Time
	}
	
	type FriendRequest struct {
		ID          uint64 `gorm:"primaryKey;autoIncrement"`
		RequesterID uint64 `gorm:"type:bigint unsigned;not null;index"`
		TargetID    uint64 `gorm:"type:bigint unsigned;not null;index"`
		Message     string
		Status      string `gorm:"type:enum('pending','accepted','rejected')"`
		CreatedAt   time.Time
		HandledAt   *time.Time
	}
	
	type Group struct {
		ID              uint64 `gorm:"primaryKey;autoIncrement"`
		Name            string `gorm:"type:varchar(100);not null"`
		AvatarURL       string `gorm:"type:varchar(255);default:'/default/group.png'"`
		OwnerID         uint64 `gorm:"type:bigint unsigned;not null;index"`
		Description     string
		Announcement    string
		NeedApproval    bool   `gorm:"type:boolean;default:true"`
		IsPrivate       bool   `gorm:"type:boolean;default:false"`
		IsMute          bool   `gorm:"type:boolean;default:false"`
		MuteAt          *time.Time
		MuteReason      string
		MutePermanent   bool   `gorm:"type:boolean;default:false"`
		MuteBy          *uint64
		MuteTexpires    *time.Time
		IsBanned        bool   `gorm:"type:boolean;default:false"`
		BannedAt        *time.Time
		BannedReason    string
		BannedPermanent bool   `gorm:"type:boolean;default:false"`
		BannedBy        *uint64
		BannedTexpires  *time.Time
		CreatedAt       time.Time
		BlockUsers      string `gorm:"type:json"`
		BackgroundURL   string `gorm:"type:varchar(255);default:'/default/background-group.png'"`
	}
	
	type GroupMember struct {
		ID             uint64 `gorm:"primaryKey;autoIncrement"`
		GroupID        uint64 `gorm:"type:bigint unsigned;not null;index"`
		UserID         uint64 `gorm:"type:bigint unsigned;not null;index"`
		Role           string `gorm:"type:enum('member','admin','owner');default:'member'"`
		Unread         int    `gorm:"type:int;not null;default:0"`
		IsMute         bool   `gorm:"type:boolean;default:false"`
		MuteAt         *time.Time
		MuteReason     string
		MutePermanent  bool   `gorm:"type:boolean;default:false"`
		MuteBy         *uint64
		MuteTexpires   *time.Time
		JoinedAt       time.Time
	}
	
	type GroupRequest struct {
		ID             uint64 `gorm:"primaryKey;autoIncrement"`
		UserID         uint64 `gorm:"type:bigint unsigned;not null;index"`
		GroupID        uint64 `gorm:"type:bigint unsigned;not null;index"`
		Message        string
		Status         string `gorm:"type:enum('pending','accepted','rejected');default:'pending'"`
		HandledBy      *uint64
		HandledMessage string
		CreatedAt      time.Time
		HandledAt      *time.Time
	}
	
	type Message struct {
		ID          uint64 `gorm:"primaryKey;autoIncrement"`
		SenderID    uint64 `gorm:"type:bigint unsigned;not null;index"`
		ReceiverType string `gorm:"type:enum('user','group');not null"`
		ReceiverID  uint64 `gorm:"type:bigint unsigned;not null"`
		MessageType string `gorm:"type:enum('text','image','audio','video','file');default:'text'"`
		Content     string
		FileURL     string `gorm:"type:varchar(255)"`
		FileName    string `gorm:"type:varchar(255)"`
		FileSize    int64
		SentAt      time.Time
	}
	
	type BannedWord struct {
		ID        uint64 `gorm:"primaryKey;autoIncrement"`
		Type      string `gorm:"type:enum('all','group');not null"`
		GroupID   *uint64
		Word      string
		Frequency uint64 `gorm:"default:0"`
		CreatedAt time.Time
	}
	
	type WebAuthn struct {
		ID               uint64 `gorm:"primaryKey;autoIncrement"`
		UserID           uint64 `gorm:"type:bigint unsigned;not null;index"`
		Name             string `gorm:"type:varchar(100);not null"`
		CredentialID     string `gorm:"type:varchar(255);not null"`
		PublicKey        string `gorm:"type:varchar(255);not null"`
		AttestationObject []byte `gorm:"type:blob;not null"`
		SignCount        int    `gorm:"type:int;not null"`
		CreatedAt        time.Time
	}
	
	type LoginRecord struct {
		ID        uint64 `gorm:"primaryKey;autoIncrement"`
		UserID    uint64 `gorm:"type:bigint unsigned;not null;index"`
		IP        string `gorm:"type:varchar(50);not null"`
		UserAgent string `gorm:"type:varchar(255);not null"`
		CreatedAt time.Time
	}
	
	// 自动迁移创建所有表
	tables := []interface{}{
		&User{}, &Friend{}, &FriendRequest{}, &Group{}, &GroupMember{},
		&GroupRequest{}, &Message{}, &BannedWord{}, &WebAuthn{}, &LoginRecord{},
	}
	
	for _, table := range tables {
		if err := dbWithDB.AutoMigrate(table); err != nil {
			return fmt.Errorf("创建表失败: %v", err)
		}
	}
	
	return nil
}

// createAdminUser 创建管理员账户
func createAdminUser(config Config, adminUser AdminUser) error {
	// 构建包含数据库名的DSN用于连接新建的数据库
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.Database.User,
		config.Database.Password,
		config.Database.Host,
		config.Database.Port,
		config.Database.Database)
	
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("连接数据库失败: %v", err)
	}
	
	// 定义完整的用户表结构（与createDatabase中定义的一致）
	type User struct {
		ID                  uint64 `gorm:"primaryKey;autoIncrement"`
		Username            string `gorm:"type:varchar(50);uniqueIndex;not null"`
		Mobile              string `gorm:"type:varchar(20);uniqueIndex"`
		Email               string `gorm:"type:varchar(255);uniqueIndex"`
		Nickname            string `gorm:"type:varchar(100);not null"`
		PasswordHash        string `gorm:"type:varchar(255)"`
		IsAdmin             bool   `gorm:"type:boolean;default:false"`
		IsFreepass          bool   `gorm:"type:boolean;default:false"`
		EmailVerified       bool   `gorm:"type:boolean;default:false"`
		IsTotpEnabled       bool   `gorm:"type:boolean;default:false"`
		TotpSecret          string `gorm:"type:varchar(255)"`
		Introduction        string `gorm:"type:text"`
		IsBanned            bool   `gorm:"type:boolean;default:false"`
		BannedAt            *time.Time
		BannedReason        string
		BannedType          string `gorm:"type:enum('login','mute','permanent')"`
		BannedBy            *uint64
		BannedTexpires      *time.Time
		AvatarURL           string `gorm:"type:varchar(255);default:'/default/avatar.png'"`
		ThemeColor          string `gorm:"type:varchar(10);default:'#4cd8b8'"`
		BackgroundURL       string `gorm:"type:varchar(255);default:'/default/background.png'"`
		SoundURL            string `gorm:"type:varchar(255);default:'/default/sound.mp3'"`
		Language            string `gorm:"type:varchar(10);default:'zh-CN'"`
		IsEmailNotification bool   `gorm:"type:boolean;default:false"`
		IsDesktopNotification bool `gorm:"type:boolean;default:false"`
		IsEmailRemind       bool   `gorm:"type:boolean;default:true"`
		CreatedAt           time.Time
	}
	
	// 对密码进行哈希处理
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminUser.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码加密失败: %v", err)
	}
	
	// 创建管理员用户
	user := User{
		Username:      adminUser.Username,
		Nickname:      adminUser.Nickname,
		PasswordHash:  string(hashedPassword),
		Email:         adminUser.Email,
		IsAdmin:       true, // 管理员账户
		CreatedAt:     time.Now(),
	}
	
	result := db.Create(&user)
	if result.Error != nil {
		return fmt.Errorf("创建管理员账户失败: %v", result.Error)
	}
	
	return nil
}

// testMySQLConnection 测试MySQL连接
func testMySQLConnection(c *gin.Context) {
	var req struct {
		Host     string `json:"host"`
		Port     string `json:"port"`  // 接收字符串类型的端口
		User     string `json:"user"`
		Password string `json:"password"`
		Database string `json:"database"`
	}
	
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数错误: " + err.Error()})
		return
	}
	
	// 检查必要参数
	if req.Host == "" || req.User == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "主机地址和用户名不能为空"})
		return
	}
	
	// 转换端口
	port := 3306 // 默认端口
	if req.Port != "" {
		if p, err := strconv.Atoi(req.Port); err == nil {
			port = p
		}
	}
	
	// 构建DSN
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		req.User, req.Password, req.Host, port, req.Database)
	
	// 如果没有指定数据库名，则只连接到服务器
	if req.Database == "" {
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=True&loc=Local",
			req.User, req.Password, req.Host, port)
	}
	
	// 设置连接超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// 尝试连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "连接失败: " + err.Error()})
		return
	}
	
	// 获取数据库实例
	sqlDB, err := db.DB()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "获取数据库实例失败: " + err.Error()})
		return
	}
	
	// 设置连接池
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetMaxOpenConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)
	
	// 测试连接
	if err := sqlDB.PingContext(ctx); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "Ping失败: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "连接成功"})
}

// testRedisConnection 测试Redis连接
func testRedisConnection(c *gin.Context) {
	var req struct {
		Host     string `json:"host"`
		Port     string `json:"port"`  // 接收字符串类型的端口
		Password string `json:"password"`
	}
	
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数错误: " + err.Error()})
		return
	}
	
	// 检查必要参数
	if req.Host == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "主机地址不能为空"})
		return
	}
	
	// 转换端口
	port := 6379 // 默认端口
	if req.Port != "" {
		if p, err := strconv.Atoi(req.Port); err == nil {
			port = p
		}
	}
	
	// 构建Redis客户端
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", req.Host, port),
		Password: req.Password,
		DB:       0,
	})
	
	// 设置连接超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	// 测试连接
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "连接失败: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "连接成功"})
}

// testEmailConnection 测试邮件连接
func testEmailConnection(c *gin.Context) {
	var req struct {
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
		Secure   bool   `json:"secure"`
	}
	
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数错误: " + err.Error()})
		return
	}
	
	// 检查必要参数
	if req.Host == "" || req.User == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "SMTP服务器和用户名不能为空"})
		return
	}
	
	// 转换端口
	port := 587 // 默认端口
	if req.Port != "" {
		if p, err := strconv.Atoi(req.Port); err == nil {
			port = p
		}
	}
	
	// 创建邮件客户端
	dialer := gomail.NewDialer(req.Host, port, req.User, req.Password)
	
	// 如果启用SSL/TLS
	if req.Secure {
		dialer.SSL = true
	}
	
	// 尝试连接（设置10秒超时）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	// 在goroutine中执行连接操作，以便能够通过context取消
	errChan := make(chan error, 1)
	go func() {
		_, err := dialer.Dial()
		errChan <- err
	}()
	
	select {
	case err := <-errChan:
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "error": "连接失败: " + err.Error()})
			return
		}
	case <-ctx.Done():
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "连接超时"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "连接成功"})
}

// testSendEmail 测试发送邮件
func testSendEmail(c *gin.Context) {
	var req struct {
		Host        string `json:"host"`
		Port        string `json:"port"`
		User        string `json:"user"`
		Password    string `json:"password"`
		From        string `json:"from"`
		Secure      bool   `json:"secure"`
		TestAddress string `json:"testAddress"`
	}
	
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数错误: " + err.Error()})
		return
	}
	
	// 检查必要参数
	if req.Host == "" || req.User == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "SMTP服务器和用户名不能为空"})
		return
	}
	
	if req.TestAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "测试邮箱地址不能为空"})
		return
	}
	
	// 转换端口
	port := 587 // 默认端口
	if req.Port != "" {
		if p, err := strconv.Atoi(req.Port); err == nil {
			port = p
		}
	}
	
	// 创建邮件消息
	m := gomail.NewMessage()
	
	// 设置发件人
	from := req.User
	if req.From != "" {
		from = req.From
	}
	m.SetHeader("From", from)
	
	// 设置收件人
	m.SetHeader("To", req.TestAddress)
	
	// 设置邮件主题和内容
	m.SetHeader("Subject", "VentiChat 安装向导测试邮件")
	m.SetBody("text/html", `
		<h2>VentiChat 邮件测试</h2>
		<p>恭喜！您的邮件配置工作正常。</p>
		<p>这是一封来自 VentiChat 安装向导的测试邮件，用于验证邮件服务器配置是否正确。</p>
		<hr>
		<p><em>此邮件由系统自动发送，请勿回复。</em></p>
	`)
	
	// 创建邮件客户端
	dialer := gomail.NewDialer(req.Host, port, req.User, req.Password)
	
	// 如果启用SSL/TLS
	if req.Secure {
		dialer.SSL = true
	}
	
	// 发送邮件（设置10秒超时）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	// 在goroutine中执行发送操作，以便能够通过context取消
	errChan := make(chan error, 1)
	go func() {
		errChan <- dialer.DialAndSend(m)
	}()
	
	select {
	case err := <-errChan:
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "error": "邮件发送失败: " + err.Error()})
			return
		}
	case <-ctx.Done():
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "邮件发送超时"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "邮件发送成功"})
}
