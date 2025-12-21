package model

import (
	"time"
)

// GroupMember 群聊成员表
type GroupMember struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupID       uint64    `gorm:"not null;index" json:"group_id"`
	UserID        uint64    `gorm:"not null;index" json:"user_id"`
	Role          string    `gorm:"type:enum('member','admin','owner');default:'member'" json:"role"`
	Unread        int       `gorm:"default:0;not null" json:"unread"`
	IsMute        bool      `gorm:"default:false" json:"is_mute"`
	MuteAt        time.Time `json:"mute_at"`
	MuteReason    string    `gorm:"type:text" json:"mute_reason"`
	MutePermanent bool      `gorm:"default:false" json:"mute_permanent"`
	MuteBy        uint64    `json:"mute_by"`
	MuteTexpires  time.Time `json:"mute_texpires"`
	JoinedAt      time.Time `json:"joined_at"`
}