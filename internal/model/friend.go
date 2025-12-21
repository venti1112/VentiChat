package model

import (
	"time"
)

// Friend 好友关系表
type Friend struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"not null;index" json:"user_id"`
	FriendID  uint64    `gorm:"not null;index" json:"friend_id"`
	Status    string    `gorm:"type:enum('active','block');default:'active'" json:"status"`
	Unread    int       `gorm:"default:0;not null" json:"unread"`
	CreatedAt time.Time `json:"created_at"`
}