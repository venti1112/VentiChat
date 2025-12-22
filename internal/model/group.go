package model

import (
	"time"
)

// Group 群聊表
type Group struct {
	ID              uint64     `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	Name            string     `gorm:"type:varchar(100);not null" json:"name"`
	AvatarURL       string     `gorm:"type:varchar(255);not null;default:'/default/group.png'" json:"avatar_url"`
	OwnerID         uint64     `gorm:"type:bigint unsigned;not null" json:"owner_id"`
	Description     string     `gorm:"type:text" json:"description"`
	Announcement    string     `gorm:"type:text" json:"announcement"`
	NeedApproval    bool       `gorm:"type:boolean;not null;default:true" json:"need_approval"`
	IsPrivate       bool       `gorm:"type:boolean;not null;default:false" json:"is_private"`
	IsMute          bool       `gorm:"type:boolean;not null;default:false" json:"is_mute"`
	MuteAt          *time.Time `gorm:"type:timestamp" json:"mute_at"`
	MuteReason      string     `gorm:"type:text" json:"mute_reason"`
	MutePermanent   bool       `gorm:"type:boolean;default:false" json:"mute_permanent"`
	MuteBy          uint64     `gorm:"type:bigint unsigned" json:"mute_by"`
	MuteTexpires    *time.Time `gorm:"type:timestamp" json:"mute_texpires"`
	IsBanned        bool       `gorm:"type:boolean;not null;default:false" json:"is_banned"`
	BannedAt        *time.Time `gorm:"type:timestamp" json:"banned_at"`
	BannedReason    string     `gorm:"type:text" json:"banned_reason"`
	BannedPermanent bool       `gorm:"type:boolean;default:false" json:"banned_permanent"`
	BannedBy        uint64     `gorm:"type:bigint unsigned" json:"banned_by"`
	BannedTexpires  *time.Time `gorm:"type:timestamp" json:"banned_texpires"`
	CreatedAt       time.Time  `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	BlockUsers      string     `gorm:"type:json" json:"block_users"`
	BackgroundURL   string     `gorm:"type:varchar(255);default:'/default/background-group.png'" json:"background_url"`
}
