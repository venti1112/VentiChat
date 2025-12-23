package app

import (
	"context"
	"fmt"
	"ventichat/internal/utils"
	"ventichat/internal/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"github.com/go-redis/redis/v8"
)

var (
	DB  *gorm.DB
	RDB *redis.Client
)

// InitDatabase 初始化数据库连接
func InitDatabase() error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		utils.AppConfig.Database.User,
		utils.AppConfig.Database.Password,
		utils.AppConfig.Database.Host,
		utils.AppConfig.Database.Port,
		utils.AppConfig.Database.Database,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default,
	})
	if err != nil {
		return fmt.Errorf("连接数据库失败: %v", err)
	}

	// 自动迁移数据库表
	if err := DB.AutoMigrate(
		&model.User{},
		&model.Friend{},
		&model.FriendRequest{},
		&model.Group{},
		&model.GroupMember{},
		&model.GroupRequest{},
		&model.Message{},
		&model.BannedWord{},
		&model.WebAuthn{},
		&model.LoginRecord{},
	); err != nil {
		return fmt.Errorf("自动迁移数据库失败: %v", err)
	}

	return nil
}

// InitRedis 初始化Redis连接
func InitRedis() error {
	RDB = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", utils.AppConfig.Redis.Host, utils.AppConfig.Redis.Port),
		Password: utils.AppConfig.Redis.Password,
		DB:       0,
	})

	// 测试连接
	ctx := context.Background()
	_, err := RDB.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("连接Redis失败: %v", err)
	}

	return nil
}