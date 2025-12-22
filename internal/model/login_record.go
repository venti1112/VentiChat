package model

import (
	"time"
)

// LoginRecord 登录日志表
type LoginRecord struct {
	ID        uint64    `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"type:bigint unsigned;not null;index" json:"user_id"`
	IP        string    `gorm:"type:varchar(50);not null" json:"ip"`
	UserAgent string    `gorm:"type:varchar(255);not null" json:"user_agent"`
	CreatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
