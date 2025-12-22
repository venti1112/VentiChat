package model

import (
	"time"
)

// Message 消息表
type Message struct {
	ID           uint64    `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	SenderID     uint64    `gorm:"type:bigint unsigned;not null;index" json:"sender_id"`
	ReceiverType string    `gorm:"type:enum('user','group');not null" json:"receiver_type"`
	ReceiverID   uint64    `gorm:"type:bigint unsigned;not null" json:"receiver_id"`
	MessageType  string    `gorm:"type:enum('text','image','audio','video','file');not null;default:'text'" json:"message_type"`
	Content      string    `gorm:"type:text" json:"content"`
	FileURL      string    `gorm:"type:varchar(255)" json:"file_url"`
	FileName     string    `gorm:"type:varchar(255)" json:"file_name"`
	FileSize     int64     `gorm:"type:bigint" json:"file_size"`
	SentAt       time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"sent_at"`
}
