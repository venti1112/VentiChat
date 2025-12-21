package model

import (
	"time"
)

// Message 消息表
type Message struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	SenderID    uint64    `gorm:"not null;index" json:"sender_id"`
	ReceiverType string    `gorm:"type:enum('user','group');not null" json:"receiver_type"`
	ReceiverID  uint64    `gorm:"not null" json:"receiver_id"`
	MessageType string    `gorm:"type:enum('text','image','audio','video','file');default:'text'" json:"message_type"`
	Content     string    `gorm:"type:text" json:"content"`
	FileURL     string    `gorm:"size:255" json:"file_url"`
	FileName    string    `gorm:"size:255" json:"file_name"`
	FileSize    int64     `json:"file_size"`
	SentAt      time.Time `json:"sent_at"`
}