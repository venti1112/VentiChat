package model

import (
	"time"
)

// GroupMember 群聊成员表
type GroupMember struct {
	ID            uint64     `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	GroupID       uint64     `gorm:"type:bigint unsigned;not null;index" json:"group_id"`
	UserID        uint64     `gorm:"type:bigint unsigned;not null;index" json:"user_id"`
	Role          string     `gorm:"type:enum('member','admin','owner');not null;default:'member'" json:"role"`
	Unread        int        `gorm:"type:int;default:0;not null" json:"unread"`
	IsMute        bool       `gorm:"type:boolean;default:false" json:"is_mute"`
	MuteAt        *time.Time `gorm:"type:timestamp" json:"mute_at"`
	MuteReason    string     `gorm:"type:text" json:"mute_reason"`
	MutePermanent bool       `gorm:"type:boolean;default:false" json:"mute_permanent"`
	MuteBy        uint64     `gorm:"type:bigint unsigned" json:"mute_by"`
	MuteTexpires  *time.Time `gorm:"type:timestamp" json:"mute_texpires"`
	JoinedAt      time.Time  `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"joined_at"`
}
