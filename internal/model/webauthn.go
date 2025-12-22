package model

import (
	"time"
)

// WebAuthn WebAuthn表
type WebAuthn struct {
	ID                uint64    `gorm:"type:bigint unsigned;primaryKey;autoIncrement" json:"id"`
	UserID            uint64    `gorm:"type:bigint unsigned;not null;index" json:"user_id"`
	Name              string    `gorm:"type:varchar(100);not null" json:"name"`
	CredentialID      string    `gorm:"type:varchar(255);not null" json:"credential_id"`
	PublicKey         string    `gorm:"type:varchar(255);not null" json:"public_key"`
	AttestationObject []byte    `gorm:"type:blob;not null" json:"attestation_object"`
	SignCount         int       `gorm:"type:int;not null" json:"sign_count"`
	CreatedAt         time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}
