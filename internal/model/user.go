package model

import (
	"time"
)

// User 用户表
type User struct {
	ID                    uint64     `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	Username              string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Mobile                string     `gorm:"type:varchar(20);uniqueIndex" json:"mobile"`
	Email                 string     `gorm:"type:varchar(255);uniqueIndex" json:"email"`
	Nickname              string     `gorm:"type:varchar(100);not null" json:"nickname"`
	PasswordHash          string     `gorm:"type:varchar(255)" json:"-"`
	IsAdmin               bool       `gorm:"type:boolean;not null;default:false" json:"is_admin"`
	IsFreepass            bool       `gorm:"type:boolean;not null;default:false" json:"is_freepass"`
	EmailVerified         bool       `gorm:"type:boolean;not null;default:false" json:"email_verified"`
	IsTotpEnabled         bool       `gorm:"type:boolean;not null;default:false" json:"is_totp_enabled"`
	TotpSecret            string     `gorm:"type:varchar(255)" json:"-"`
	Introduction          string     `gorm:"type:text" json:"introduction"`
	IsBanned              bool       `gorm:"type:boolean;not null;default:false" json:"is_banned"`
	BannedAt              *time.Time `gorm:"type:timestamp" json:"banned_at"`
	BannedReason          string     `gorm:"type:text" json:"banned_reason"`
	BannedType            string     `gorm:"type:enum('login','mute','permanent');default:null" json:"banned_type"`
	BannedBy              *uint64    `gorm:"type:bigint unsigned" json:"banned_by"`
	BannedTexpires        *time.Time `gorm:"type:timestamp" json:"banned_texpires"`
	AvatarURL             string     `gorm:"type:varchar(255);not null;default:'/default/avatar.png'" json:"avatar_url"`
	ThemeColor            string     `gorm:"type:varchar(10);not null;default:'#4cd8b8'" json:"theme_color"`
	BackgroundURL         string     `gorm:"type:varchar(255);not null;default:'/default/background.png'" json:"background_url"`
	SoundURL              string     `gorm:"type:varchar(255);not null;default:'/default/sound.mp3'" json:"sound_url"`
	Language              string     `gorm:"type:varchar(10);not null;default:'zh-CN'" json:"language"`
	IsEmailNotification   bool       `gorm:"type:boolean;not null;default:false" json:"is_email_notification"`
	IsDesktopNotification bool       `gorm:"type:boolean;not null;default:false" json:"is_desktop_notification"`
	IsEmailRemind         bool       `gorm:"type:boolean;not null;default:true" json:"is_email_remind"`
	CreatedAt             time.Time  `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
