package model

import (
	"time"
)

// BannedWord 违禁词表
type BannedWord struct {
	ID        uint64    `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	Type      string    `gorm:"type:enum('all','group');not null" json:"type"`
	GroupID   uint64    `gorm:"type:bigint unsigned" json:"group_id"`
	Word      string    `gorm:"type:text;not null" json:"word"`
	Frequency uint64    `gorm:"type:bigint unsigned;not null;default:0" json:"frequency"`
	CreatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
