package model

import (
	"time"
)

// FriendRequest 好友申请表
type FriendRequest struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	RequesterID uint64    `gorm:"not null;index" json:"requester_id"`
	TargetID    uint64    `gorm:"not null;index" json:"target_id"`
	Message     string    `gorm:"type:text" json:"message"`
	Status      string    `gorm:"type:enum('pending','accepted','rejected')" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	HandledAt   time.Time `json:"handled_at"`
}