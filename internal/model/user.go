package model

import (
	"time"
)

// User 用户表
type User struct {
	ID                  uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Username            string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Mobile              string    `gorm:"uniqueIndex;size:20" json:"mobile"`
	Email               string    `gorm:"uniqueIndex;size:255" json:"email"`
	Nickname            string    `gorm:"size:100;not null" json:"nickname"`
	PasswordHash        string    `gorm:"size:255" json:"-"`
	IsAdmin             bool      `gorm:"default:false" json:"is_admin"`
	IsFreepass          bool      `gorm:"default:false" json:"is_freepass"`
	EmailVerified       bool      `gorm:"default:false" json:"email_verified"`
	IsTotpEnabled       bool      `gorm:"default:false" json:"is_totp_enabled"`
	TotpSecret          string    `gorm:"size:255" json:"-"`
	Introduction        string    `gorm:"type:text" json:"introduction"`
	IsBanned            bool      `gorm:"default:false" json:"is_banned"`
	BannedAt            time.Time `json:"banned_at"`
	BannedReason        string    `gorm:"type:text" json:"banned_reason"`
	BannedType          string    `gorm:"type:enum('login','mute','permanent')" json:"banned_type"`
	BannedBy            uint64    `json:"banned_by"`
	BannedTexpires      time.Time `json:"banned_texpires"`
	AvatarURL           string    `gorm:"size:255;default:'/default/avatar.png'" json:"avatar_url"`
	ThemeColor          string    `gorm:"size:10;default:'#4cd8b8'" json:"theme_color"`
	BackgroundURL       string    `gorm:"size:255;default:'/default/background.png'" json:"background_url"`
	SoundURL            string    `gorm:"size:255;default:'/default/sound.mp3'" json:"sound_url"`
	Language            string    `gorm:"size:10;default:'zh-CN'" json:"language"`
	IsEmailNotification bool      `gorm:"default:false" json:"is_email_notification"`
	IsDesktopNotification bool    `gorm:"default:false" json:"is_desktop_notification"`
	IsEmailRemind       bool      `gorm:"default:true" json:"is_email_remind"`
	CreatedAt           time.Time `json:"created_at"`
}