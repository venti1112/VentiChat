package handler

import (
	"net/http"
	"strconv"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SendFriendRequest 发送好友申请
func SendFriendRequest(c *gin.Context) {
	var req struct {
		TargetUsername string `json:"target_username" binding:"required"`
		Message        string `json:"message"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	// 获取当前用户ID
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 查找目标用户
	var targetUser model.User
	result := repository.DB.Where("username = ? OR email = ?", req.TargetUsername, req.TargetUsername).First(&targetUser)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "目标用户不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "查询用户失败",
		})
		return
	}

	// 不能添加自己为好友
	if currentUserID.(uint64) == targetUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "不能添加自己为好友",
		})
		return
	}

	// 检查是否已经是好友
	var existingFriend model.Friend
	result = repository.DB.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", 
		currentUserID.(uint64), targetUser.ID, targetUser.ID, currentUserID.(uint64)).First(&existingFriend)
	if result.Error == nil {
		// 已经是好友
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "你们已经是好友了",
		})
		return
	}

	// 检查是否已经发送过好友请求
	var existingRequest model.FriendRequest
	result = repository.DB.Where("(requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?) AND status = 'pending'", 
		currentUserID.(uint64), targetUser.ID, targetUser.ID, currentUserID.(uint64)).First(&existingRequest)
	if result.Error == nil {
		// 已经有未处理的请求
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "已经有一个好友请求在等待处理",
		})
		return
	}

	// 创建好友请求
	friendReq := model.FriendRequest{
		RequesterID: currentUserID.(uint64),
		TargetID:    targetUser.ID,
		Message:     req.Message,
		Status:      "pending",
	}

	result = repository.DB.Create(&friendReq)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "发送好友请求失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "好友请求发送成功",
		"request_id": friendReq.ID,
	})
}

// GetFriendRequests 获取好友请求列表
func GetFriendRequests(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 获取收到的好友请求
	var requests []model.FriendRequest
	err := repository.DB.Preload("Requester").Where("target_id = ? AND status = 'pending'", currentUserID.(uint64)).Find(&requests).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取好友请求失败",
		})
		return
	}

	// 获取发送的好友请求
	var sentRequests []model.FriendRequest
	err = repository.DB.Preload("Target").Where("requester_id = ? AND status = 'pending'", currentUserID.(uint64)).Find(&sentRequests).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取发送的好友请求失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"received_requests": requests,
		"sent_requests":     sentRequests,
	})
}

// HandleFriendRequest 处理好友请求（接受或拒绝）
func HandleFriendRequest(c *gin.Context) {
	var req struct {
		RequestID      uint64 `json:"request_id" binding:"required"`
		Action         string `json:"action" binding:"required"` // "accept" or "reject"
		HandledMessage string `json:"handled_message"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	if req.Action != "accept" && req.Action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "操作类型错误，只能是 'accept' 或 'reject'",
		})
		return
	}

	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 查找好友请求
	var request model.FriendRequest
	err := repository.DB.Where("id = ? AND target_id = ? AND status = 'pending'", req.RequestID, currentUserID.(uint64)).First(&request).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "好友请求不存在或已被处理",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "查询好友请求失败",
		})
		return
	}

	// 更新请求状态
	newStatus := "rejected"
	if req.Action == "accept" {
		newStatus = "accepted"
	}

	request.Status = newStatus
	now := time.Now()
	request.HandledAt = &now
	request.HandledMessage = req.HandledMessage

	err = repository.DB.Save(&request).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新好友请求失败",
		})
		return
	}

	// 如果接受好友请求，则创建好友关系
	if req.Action == "accept" {
		// 创建双向好友关系
		friend1 := model.Friend{
			UserID:   request.RequesterID,
			FriendID: request.TargetID,
			Status:   "active",
		}
		
		friend2 := model.Friend{
			UserID:   request.TargetID,
			FriendID: request.RequesterID,
			Status:   "active",
		}

		err = repository.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&friend1).Error; err != nil {
				return err
			}
			if err := tx.Create(&friend2).Error; err != nil {
				return err
			}
			return nil
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "创建好友关系失败",
			})
			return
		}

		// 发送系统通知给双方（可选）
		// 可以通过WebSocket发送实时通知
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "好友请求处理成功",
		"status":  newStatus,
	})
}

// GetFriends 获取好友列表
func GetFriends(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 获取当前用户的好友列表
	var friends []model.Friend
	err := repository.DB.Preload("Friend").Where("user_id = ? AND status = 'active'", currentUserID.(uint64)).Find(&friends).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取好友列表失败",
		})
		return
	}

	// 获取好友的详细信息
	friendDetails := make([]gin.H, len(friends))
	for i, friend := range friends {
		friendDetails[i] = gin.H{
			"id":         friend.Friend.ID,
			"username":   friend.Friend.Username,
			"nickname":   friend.Friend.Nickname,
			"avatar_url": friend.Friend.AvatarURL,
			"unread":     friend.Unread,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"friends": friendDetails,
	})
}

// RemoveFriend 删除好友
func RemoveFriend(c *gin.Context) {
	friendIDStr := c.Param("friend_id")
	friendID, err := strconv.ParseUint(friendIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的好友ID",
		})
		return
	}

	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 检查好友关系是否存在
	var friend model.Friend
	err = repository.DB.Where("user_id = ? AND friend_id = ? AND status = 'active'", currentUserID.(uint64), friendID).First(&friend).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "好友关系不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "查询好友关系失败",
		})
		return
	}

	// 删除双向好友关系
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND friend_id = ?", currentUserID.(uint64), friendID).Delete(&model.Friend{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND friend_id = ?", friendID, currentUserID.(uint64)).Delete(&model.Friend{}).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除好友失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "好友删除成功",
	})
}

// SearchUsers 搜索用户
func SearchUsers(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "用户名不能为空",
		})
		return
	}

	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	var users []model.User
	err := repository.DB.Where("username LIKE ? AND id != ?", "%"+username+"%", currentUserID.(uint64)).Limit(10).Find(&users).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "搜索用户失败",
		})
		return
	}

	// 检查是否已经是好友
	result := make([]gin.H, len(users))
	for i, user := range users {
		var friend model.Friend
		err := repository.DB.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", 
			currentUserID.(uint64), user.ID, user.ID, currentUserID.(uint64)).First(&friend).Error
		isFriend := err == nil
		
		result[i] = gin.H{
			"id":         user.ID,
			"username":   user.Username,
			"nickname":   user.Nickname,
			"avatar_url": user.AvatarURL,
			"is_friend":  isFriend,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"users": result,
	})
}

// BlockFriend 拉黑好友
func BlockFriend(c *gin.Context) {
	friendIDStr := c.Param("friend_id")
	friendID, err := strconv.ParseUint(friendIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的好友ID",
		})
		return
	}

	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 检查好友关系是否存在
	var friend model.Friend
	err = repository.DB.Where("user_id = ? AND friend_id = ? AND status = 'active'", currentUserID.(uint64), friendID).First(&friend).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "好友关系不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "查询好友关系失败",
		})
		return
	}

	// 更新好友状态为block
	friend.Status = "block"
	err = repository.DB.Save(&friend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "拉黑好友失败",
		})
		return
	}

	// 同时更新对方关系状态
	var reverseFriend model.Friend
	err = repository.DB.Where("user_id = ? AND friend_id = ?", friendID, currentUserID.(uint64)).First(&reverseFriend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新反向关系失败",
		})
		return
	}

	reverseFriend.Status = "block"
	err = repository.DB.Save(&reverseFriend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新反向关系失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "好友拉黑成功",
	})
}

// GetBlockedFriends 获取被拉黑的好友列表
func GetBlockedFriends(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 获取当前用户的被拉黑好友列表
	var friends []model.Friend
	err := repository.DB.Preload("Friend").Where("user_id = ? AND status = 'block'", currentUserID.(uint64)).Find(&friends).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取被拉黑好友列表失败",
		})
		return
	}

	// 获取被拉黑好友的详细信息
	friendDetails := make([]gin.H, len(friends))
	for i, friend := range friends {
		friendDetails[i] = gin.H{
			"id":         friend.Friend.ID,
			"username":   friend.Friend.Username,
			"nickname":   friend.Friend.Nickname,
			"avatar_url": friend.Friend.AvatarURL,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"blocked_friends": friendDetails,
	})
}

// UnblockFriend 解除拉黑好友
func UnblockFriend(c *gin.Context) {
	friendIDStr := c.Param("friend_id")
	friendID, err := strconv.ParseUint(friendIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的好友ID",
		})
		return
	}

	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 检查好友关系是否存在且状态为block
	var friend model.Friend
	err = repository.DB.Where("user_id = ? AND friend_id = ? AND status = 'block'", currentUserID.(uint64), friendID).First(&friend).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "被拉黑的好友关系不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "查询好友关系失败",
		})
		return
	}

	// 更新好友状态为active
	friend.Status = "active"
	err = repository.DB.Save(&friend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "解除拉黑好友失败",
		})
		return
	}

	// 同时更新对方关系状态
	var reverseFriend model.Friend
	err = repository.DB.Where("user_id = ? AND friend_id = ?", friendID, currentUserID.(uint64)).First(&reverseFriend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新反向关系失败",
		})
		return
	}

	reverseFriend.Status = "active"
	err = repository.DB.Save(&reverseFriend).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新反向关系失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "解除拉黑好友成功",
	})
}