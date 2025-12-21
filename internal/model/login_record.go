package model

import (
	"time"
)

// LoginRecord 登录日志表
type LoginRecord struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"not null;index" json:"user_id"`
	IP        string    `gorm:"size:50;not null" json:"ip"`
	UserAgent string    `gorm:"size:255;not null" json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}