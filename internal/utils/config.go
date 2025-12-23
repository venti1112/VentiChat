package utils

import (
	"log"
	"math/rand"
	"strconv"
	"time"

	"github.com/spf13/viper"
)

// StringToUint64 将字符串转换为uint64
func StringToUint64(s string) uint64 {
	if s == "" {
		return 0
	}
	result, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		log.Printf("转换字符串到uint64失败: %v", err)
		return 0
	}
	return result
}

// GenerateRandomString 生成指定长度的随机字符串
func GenerateRandomString(length int) string {
	rand.Seed(time.Now().UnixNano())
	chars := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		result[i] = chars[rand.Intn(len(chars))]
	}
	return string(result)
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host  string `mapstructure:"host"`
	Port  int    `mapstructure:"port"`
	Level string `mapstructure:"level"`
	Name  string `mapstructure:"name"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Database string `mapstructure:"database"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
}

// EmailConfig 邮件配置
type EmailConfig struct {
	Enable   bool   `mapstructure:"enable"`
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Secure   bool   `mapstructure:"secure"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Key        string `mapstructure:"key"`
	Expiration int    `mapstructure:"expiration"`
}

// IPBanConfig IP封禁配置
type IPBanConfig struct {
	Number int `mapstructure:"number"`
	Time   int `mapstructure:"time"`
}

// SendFrequencyConfig 发送频率配置
type SendFrequencyConfig struct {
	Time   int `mapstructure:"time"`
	Number int `mapstructure:"number"`
}

// Config 全局配置
type Config struct {
	Server        ServerConfig        `mapstructure:"server"`
	Database      DatabaseConfig      `mapstructure:"database"`
	Redis         RedisConfig         `mapstructure:"redis"`
	Email         EmailConfig         `mapstructure:"email"`
	JWT           JWTConfig           `mapstructure:"jwt"`
	IPBan         IPBanConfig         `mapstructure:"ipBan"`
	SendFrequency SendFrequencyConfig `mapstructure:"sendFrequency"`
}

var AppConfig *Config

// InitConfig 初始化配置
func InitConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./config")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("读取配置文件失败: %v", err)
	}

	AppConfig = &Config{}
	if err := viper.Unmarshal(AppConfig); err != nil {
		log.Fatalf("解析配置文件失败: %v", err)
	}
}