package model

import (
	"time"
)

// GroupRequest 群聊申请表
type GroupRequest struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         uint64    `gorm:"not null;index" json:"user_id"`
	GroupID        uint64    `gorm:"not null;index" json:"group_id"`
	Message        string    `gorm:"type:text" json:"message"`
	Status         string    `gorm:"type:enum('pending','accepted','rejected');default:'pending'" json:"status"`
	HandledBy      uint64    `json:"handled_by"`
	HandledMessage string    `gorm:"type:text" json:"handled_message"`
	CreatedAt      time.Time `json:"created_at"`
	HandledAt      time.Time `json:"handled_at"`
}