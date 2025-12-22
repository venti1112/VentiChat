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
	"gopkg.in/gomail.v2"
	"gopkg.in/yaml.v3"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"ventichat/internal/model"
)

// 全局变量用于通知安装完成
var (
	installationCompleted bool
	serverMutex           sync.Mutex
	httpServer            *http.Server
)

// Config 安装配置结构体
type Config struct {
	Server struct {
		Host  string `yaml:"host"`
		Port  int    `yaml:"port"`
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

	// 设置GIN
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Recovery())

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
	// 添加禁止缓存的HTTP头
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	
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

	// 获取默认聊天室名称
	defaultGroupName := c.PostForm("default_group_name")
	if defaultGroupName == "" {
		defaultGroupName = "默认聊天室"
	}

	// 创建数据库
	err = createDatabase(config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建数据库失败: " + err.Error()})
		return
	}

	// 创建管理员账户
	adminUserID, err := createAdminUser(config, adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建管理员账户失败: " + err.Error()})
		return
	}

	// 创建默认聊天室并将管理员加入其中
	err = createDefaultGroup(config, defaultGroupName, adminUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建默认聊天室失败: " + err.Error()})
		return
	}

	// 保存配置文件
	err = saveConfig(config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存配置文件失败: " + err.Error()})
		return
	}

	// 标记安装完成
	serverMutex.Lock()
	installationCompleted = true
	serverMutex.Unlock()

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"port":   config.Server.Port,
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

	// 自动迁移创建所有表
	tables := []interface{}{
		&model.User{}, &model.Friend{}, &model.FriendRequest{}, &model.Group{}, &model.GroupMember{},
		&model.GroupRequest{}, &model.Message{}, &model.BannedWord{}, &model.WebAuthn{}, &model.LoginRecord{},
	}

	for _, table := range tables {
		if err := dbWithDB.AutoMigrate(table); err != nil {
			return fmt.Errorf("创建表失败: %v", err)
		}
	}

	return nil
}

// createAdminUser 创建管理员账户
func createAdminUser(config Config, adminUser AdminUser) (uint64, error) {
	// 构建包含数据库名的DSN用于连接新建的数据库
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.Database.User,
		config.Database.Password,
		config.Database.Host,
		config.Database.Port,
		config.Database.Database)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return 0, fmt.Errorf("连接数据库失败: %v", err)
	}

	// 对密码进行哈希处理
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminUser.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, fmt.Errorf("密码加密失败: %v", err)
	}

	// 创建管理员用户
	user := model.User{
		Username:     adminUser.Username,
		Nickname:     adminUser.Nickname,
		PasswordHash: string(hashedPassword),
		Email:        adminUser.Email,
		IsAdmin:      true,
	}

	result := db.Create(&user)
	if result.Error != nil {
		return 0, fmt.Errorf("创建管理员账户失败: %v", result.Error)
	}

	return user.ID, nil
}

// createDefaultGroup 创建默认聊天室并将管理员加入其中
func createDefaultGroup(config Config, groupName string, adminUserID uint64) error {
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

	group := model.Group{
		Name:        groupName,
		OwnerID:     adminUserID,
		Description: "默认聊天室",
		BlockUsers:  "[]",
	}

	result := db.Create(&group)
	if result.Error != nil {
		return fmt.Errorf("创建默认聊天室失败: %v", result.Error)
	}

	// 将管理员加入聊天室
	groupMember := model.GroupMember{
		GroupID: group.ID,
		UserID:  adminUserID,
		Role:    "owner",
	}

	result = db.Create(&groupMember)
	if result.Error != nil {
		return fmt.Errorf("将管理员加入默认聊天室失败: %v", result.Error)
	}

	return nil
}

// testMySQLConnection 测试MySQL连接
func testMySQLConnection(c *gin.Context) {
	var req struct {
		Host     string `json:"host"`
		Port     string `json:"port"` // 接收字符串类型的端口
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
		Port     string `json:"port"` // 接收字符串类型的端口
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
