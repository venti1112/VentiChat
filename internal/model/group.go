package model

import (
	"time"
)

// Group 群聊表
type Group struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name            string    `gorm:"size:100;not null" json:"name"`
	AvatarURL       string    `gorm:"size:255;default:'/default/group.png'" json:"avatar_url"`
	OwnerID         uint64    `gorm:"not null" json:"owner_id"`
	Description     string    `gorm:"type:text" json:"description"`
	Announcement    string    `gorm:"type:text" json:"announcement"`
	NeedApproval    bool      `gorm:"default:true" json:"need_approval"`
	IsPrivate       bool      `gorm:"default:false" json:"is_private"`
	IsMute          bool      `gorm:"default:false" json:"is_mute"`
	MuteAt          time.Time `json:"mute_at"`
	MuteReason      string    `gorm:"type:text" json:"mute_reason"`
	MutePermanent   bool      `gorm:"default:false" json:"mute_permanent"`
	MuteBy          uint64    `json:"mute_by"`
	MuteTexpires    time.Time `json:"mute_texpires"`
	IsBanned        bool      `gorm:"default:false" json:"is_banned"`
	BannedAt        time.Time `json:"banned_at"`
	BannedReason    string    `gorm:"type:text" json:"banned_reason"`
	BannedPermanent bool      `gorm:"default:false" json:"banned_permanent"`
	BannedBy        uint64    `json:"banned_by"`
	BannedTexpires  time.Time `json:"banned_texpires"`
	CreatedAt       time.Time `json:"created_at"`
	BlockUsers      string    `gorm:"type:json" json:"block_users"` // JSON格式存储被拉黑的用户ID列表
	BackgroundURL   string    `gorm:"size:255;default:'/default/background-group.png'" json:"background_url"`
}