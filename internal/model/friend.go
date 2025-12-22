package model

import (
	"time"
)

// Friend 好友关系表
type Friend struct {
	ID        uint64    `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `gorm:"type:bigint unsigned;not null;index" json:"user_id"`
	FriendID  uint64    `gorm:"type:bigint unsigned;not null;index" json:"friend_id"`
	Status    string    `gorm:"type:enum('active','block');not null;default:'active'" json:"status"`
	Unread    int       `gorm:"type:int;not null;default:0" json:"unread"`
	CreatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
