package model

import (
	"time"
)

// BannedWord 违禁词表
type BannedWord struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Type      string    `gorm:"type:enum('all','group');not null" json:"type"`
	GroupID   uint64    `json:"group_id"`
	Word      string    `gorm:"type:text;not null" json:"word"`
	Frequency uint64    `gorm:"default:0" json:"frequency"`
	CreatedAt time.Time `json:"created_at"`
}