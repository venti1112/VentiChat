package model

import (
	"time"
)

// GroupRequest 群聊申请表
type GroupRequest struct {
	ID             uint64     `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	UserID         uint64     `gorm:"type:bigint unsigned;not null;index" json:"user_id"`
	GroupID        uint64     `gorm:"type:bigint unsigned;not null;index" json:"group_id"`
	Message        string     `gorm:"type:text" json:"message"`
	Status         string     `gorm:"type:enum('pending','accepted','rejected');not null;default:'pending'" json:"status"`
	HandledBy      uint64     `gorm:"type:bigint unsigned" json:"handled_by"`
	HandledMessage string     `gorm:"type:text" json:"handled_message"`
	CreatedAt      time.Time  `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	HandledAt      *time.Time `gorm:"type:timestamp" json:"handled_at"`
}
