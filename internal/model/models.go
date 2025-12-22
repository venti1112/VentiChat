package model

// Models 包含所有模型的集合
type Models struct {
	User          User
	Friend        Friend
	FriendRequest FriendRequest
	Group         Group
	GroupMember   GroupMember
	GroupRequest  GroupRequest
	Message       Message
	BannedWord    BannedWord
	WebAuthn      WebAuthn
	LoginRecord   LoginRecord
}

// NewModels 创建并返回一个包含所有模型的新实例
func NewModels() *Models {
	return &Models{
		User:          User{},
		Friend:        Friend{},
		FriendRequest: FriendRequest{},
		Group:         Group{},
		GroupMember:   GroupMember{},
		GroupRequest:  GroupRequest{},
		Message:       Message{},
		BannedWord:    BannedWord{},
		WebAuthn:      WebAuthn{},
		LoginRecord:   LoginRecord{},
	}
}
