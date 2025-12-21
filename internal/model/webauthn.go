package model

import (
	"time"
)

// WebAuthn WebAuthn表
type WebAuthn struct {
	ID                uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID            uint64    `gorm:"not null;index" json:"user_id"`
	Name              string    `gorm:"size:100;not null" json:"name"`
	CredentialID      string    `gorm:"size:255;not null" json:"credential_id"`
	PublicKey         string    `gorm:"size:255;not null" json:"public_key"`
	AttestationObject []byte    `gorm:"type:blob;not null" json:"attestation_object"`
	SignCount         int       `gorm:"not null" json:"sign_count"`
	CreatedAt         time.Time `json:"created_at"`
}