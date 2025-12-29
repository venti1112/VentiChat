package model

import (
	"time"
)

// FriendRequest 好友申请表
type FriendRequest struct {
	ID             uint64     `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	RequesterID    uint64     `gorm:"type:bigint unsigned;not null;index" json:"requester_id"`
	TargetID       uint64     `gorm:"type:bigint unsigned;not null;index" json:"target_id"`
	Message        string     `gorm:"type:text" json:"message"`
	Status         string     `gorm:"type:enum('pending','accepted','rejected');not null;default:'pending'" json:"status"`
	HandledMessage string     `gorm:"type:text" json:"handled_message"`
	CreatedAt      time.Time  `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	HandledAt      *time.Time `gorm:"type:timestamp" json:"handled_at"`
	Requester      User       `gorm:"foreignKey:RequesterID;references:ID" json:"requester"`
	Target         User       `gorm:"foreignKey:TargetID;references:ID" json:"target"`
}
