package handler

import (
	"net/http"
	"strconv"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"

	"github.com/gin-gonic/gin"
)

// CreateGroup 创建群聊
func CreateGroup(c *gin.Context) {
	var req struct {
		Name         string `json:"name" binding:"required,max=100"`
		Description  string `json:"description"`
		AvatarURL    string `json:"avatar_url"`
		NeedApproval bool   `json:"need_approval"`
		IsPrivate    bool   `json:"is_private"`
		Announcement string `json:"announcement"`
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

	// 设置默认头像
	if req.AvatarURL == "" {
		req.AvatarURL = "/default/group.png"
	}

	// 创建群聊
	group := model.Group{
		Name:         req.Name,
		Description:  req.Description,
		AvatarURL:    req.AvatarURL,
		OwnerID:      currentUserID.(uint64),
		NeedApproval: req.NeedApproval,
		IsPrivate:    req.IsPrivate,
		Announcement: req.Announcement,
	}

	result := repository.DB.Create(&group)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建群聊失败",
		})
		return
	}

	// 将创建者添加为群主
	groupMember := model.GroupMember{
		GroupID:  group.ID,
		UserID:   currentUserID.(uint64),
		Role:     "owner",
		Unread:   0,
		IsMute:   false,
		JoinedAt: time.Now(),
	}

	result = repository.DB.Create(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "添加群主失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "群聊创建成功",
		"group":   group,
	})
}

// GetGroups 获取用户加入的群聊列表
func GetGroups(c *gin.Context) {
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	var groupMembers []model.GroupMember
	err := repository.DB.Where("user_id = ?", currentUserID.(uint64)).Find(&groupMembers).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取群聊列表失败",
		})
		return
	}

	var groupIDs []uint64
	for _, member := range groupMembers {
		groupIDs = append(groupIDs, member.GroupID)
	}

	var groups []model.Group
	if len(groupIDs) > 0 {
		err = repository.DB.Where("id IN ?", groupIDs).Find(&groups).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "查询群聊失败",
			})
			return
		}
	}

	// 添加群成员数量信息
	var groupData []gin.H
	for _, group := range groups {
		var memberCount int64
		repository.DB.Model(&model.GroupMember{}).Where("group_id = ?", group.ID).Count(&memberCount)

		groupData = append(groupData, gin.H{
			"id":            group.ID,
			"name":          group.Name,
			"avatar_url":    group.AvatarURL,
			"description":   group.Description,
			"owner_id":      group.OwnerID,
			"announcement":  group.Announcement,
			"need_approval": group.NeedApproval,
			"is_private":    group.IsPrivate,
			"is_mute":       group.IsMute,
			"member_count":  memberCount,
			"created_at":    group.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"groups": groupData,
	})
}

// GetGroupMembers 获取群聊成员列表
func GetGroupMembers(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	// 检查用户是否在群聊中
	currentUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ?", groupID, currentUserID.(uint64)).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您不在该群聊中",
		})
		return
	}

	// 获取群聊成员列表
	var members []model.GroupMember
	err = repository.DB.Where("group_id = ?", groupID).Find(&members).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取群成员列表失败",
		})
		return
	}

	// 获取成员的详细信息
	var memberData []gin.H
	for _, member := range members {
		var user model.User
		userResult := repository.DB.Select("id, username, nickname, avatar_url").Where("id = ?", member.UserID).First(&user)
		if userResult.Error != nil {
			continue // 跳过找不到的用户
		}

		memberData = append(memberData, gin.H{
			"id":           member.ID,
			"user_id":      user.ID,
			"username":     user.Username,
			"nickname":     user.Nickname,
			"avatar_url":   user.AvatarURL,
			"role":         member.Role,
			"is_mute":      member.IsMute,
			"joined_at":    member.JoinedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"members": memberData,
	})
}

// JoinGroup 申请加入群聊
func JoinGroup(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
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

	// 检查群聊是否存在
	var group model.Group
	result := repository.DB.Where("id = ?", groupID).First(&group)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "群聊不存在",
		})
		return
	}

	// 检查用户是否已经是群成员
	var existingMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, currentUserID.(uint64)).First(&existingMember)
	if result.Error == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "您已经是该群聊的成员",
		})
		return
	}

	// 如果群聊是私有的或需要审批，创建申请
	if group.IsPrivate || group.NeedApproval {
		// 检查是否已有申请
		var existingRequest model.GroupRequest
		result = repository.DB.Where("user_id = ? AND group_id = ? AND status = ?", 
			currentUserID.(uint64), groupID, "pending").First(&existingRequest)
		if result.Error == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "已有加入群聊的申请，请等待审批",
			})
			return
		}

		// 创建群聊申请
		request := model.GroupRequest{
			UserID:  currentUserID.(uint64),
			GroupID: groupID,
			Message: "申请加入群聊",
			Status:  "pending",
		}

		result = repository.DB.Create(&request)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "提交申请失败",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "已提交加入群聊申请，请等待管理员审批",
		})
	} else {
		// 直接加入群聊
		member := model.GroupMember{
			GroupID:  groupID,
			UserID:   currentUserID.(uint64),
			Role:     "member",
			Unread:   0,
			IsMute:   false,
			JoinedAt: time.Now(),
		}

		result = repository.DB.Create(&member)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "加入群聊失败",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "成功加入群聊",
		})
	}
}

// LeaveGroup 退出群聊
func LeaveGroup(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
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

	// 检查用户是否是群成员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ?", groupID, currentUserID.(uint64)).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您不是该群聊的成员",
		})
		return
	}

	// 如果用户是群主，不允许退出（需要先转让群聊）
	if groupMember.Role == "owner" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "群主不能直接退出群聊，请先转让群聊",
		})
		return
	}

	// 删除群成员记录
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, currentUserID.(uint64)).Delete(&model.GroupMember{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "退出群聊失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "已退出群聊",
	})
}

// GetGroupRequests 获取群聊申请列表
func GetGroupRequests(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
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

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", groupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限查看群聊申请",
		})
		return
	}

	// 获取群聊申请列表
	var requests []model.GroupRequest
	err = repository.DB.Where("group_id = ? AND status = ?", groupID, "pending").Find(&requests).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取群聊申请列表失败",
		})
		return
	}

	// 添加申请人信息
	var requestData []gin.H
	for _, request := range requests {
		var user model.User
		userResult := repository.DB.Select("id, username, nickname, avatar_url").Where("id = ?", request.UserID).First(&user)
		if userResult.Error != nil {
			continue // 跳过找不到的用户
		}

		requestData = append(requestData, gin.H{
			"id":      request.ID,
			"user_id": user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"avatar_url": user.AvatarURL,
			"message": request.Message,
			"created_at": request.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"requests": requestData,
	})
}

// HandleGroupRequest 处理群聊申请
func HandleGroupRequest(c *gin.Context) {
	requestIDStr := c.Param("request_id")
	requestID, err := strconv.ParseUint(requestIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的申请ID",
		})
		return
	}

	var req struct {
		Action string `json:"action" binding:"required,oneof=accept reject"`
		Reason string `json:"reason"`
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

	// 获取申请信息
	var request model.GroupRequest
	result := repository.DB.Where("id = ?", requestID).First(&request)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "申请不存在",
		})
		return
	}

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", 
		request.GroupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限处理该申请",
		})
		return
	}

	// 更新申请状态
	status := "rejected"
	if req.Action == "accept" {
		status = "accepted"
	}

	request.Status = status
	request.HandledBy = currentUserID.(uint64)
	request.HandledMessage = req.Reason
	request.HandledAt = &time.Time{}
	*request.HandledAt = time.Now()

	result = repository.DB.Save(&request)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "处理申请失败",
		})
		return
	}

	// 如果是接受申请，添加用户到群聊
	if req.Action == "accept" {
		// 检查用户是否已经是群成员
		var existingMember model.GroupMember
		result = repository.DB.Where("group_id = ? AND user_id = ?", request.GroupID, request.UserID).First(&existingMember)
		if result.Error != nil {
			// 添加用户到群聊
			member := model.GroupMember{
				GroupID:  request.GroupID,
				UserID:   request.UserID,
				Role:     "member",
				Unread:   0,
				IsMute:   false,
				JoinedAt: time.Now(),
			}

			result = repository.DB.Create(&member)
			if result.Error != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "添加群成员失败",
				})
				return
			}
		}
	}

	actionText := "拒绝"
	if req.Action == "accept" {
		actionText = "接受"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "已" + actionText + "群聊申请",
	})
}

// UpdateGroupInfo 更新群聊信息
func UpdateGroupInfo(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	var req struct {
		Name         string `json:"name" binding:"max=100"`
		Description  string `json:"description"`
		AvatarURL    string `json:"avatar_url"`
		Announcement string `json:"announcement"`
		NeedApproval *bool  `json:"need_approval"`
		IsPrivate    *bool  `json:"is_private"`
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

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", 
		groupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限修改群聊信息",
		})
		return
	}

	// 更新群聊信息
	var group model.Group
	result = repository.DB.Where("id = ?", groupID).First(&group)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "群聊不存在",
		})
		return
	}

	// 只更新非空字段
	if req.Name != "" {
		group.Name = req.Name
	}
	if req.Description != "" {
		group.Description = req.Description
	}
	if req.AvatarURL != "" {
		group.AvatarURL = req.AvatarURL
	}
	if req.Announcement != "" {
		group.Announcement = req.Announcement
	}
	if req.NeedApproval != nil {
		group.NeedApproval = *req.NeedApproval
	}
	if req.IsPrivate != nil {
		group.IsPrivate = *req.IsPrivate
	}

	result = repository.DB.Save(&group)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新群聊信息失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "群聊信息更新成功",
		"group":   group,
	})
}

// TransferGroup 转让群聊
func TransferGroup(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	var req struct {
		NewOwnerID uint64 `json:"new_owner_id" binding:"required"`
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

	// 检查用户是否是群主
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role = ?", 
		groupID, currentUserID.(uint64), "owner").First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限转让群聊",
		})
		return
	}

	// 检查新群主是否是群成员
	var newOwnerMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, req.NewOwnerID).First(&newOwnerMember)
	if result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "新群主不是群成员",
		})
		return
	}

	// 更新原群主角色为管理员
	groupMember.Role = "admin"
	result = repository.DB.Save(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新原群主角色失败",
		})
		return
	}

	// 更新新群主角色为群主
	newOwnerMember.Role = "owner"
	result = repository.DB.Save(&newOwnerMember)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新新群主角色失败",
		})
		return
	}

	// 更新群聊的OwnerID
	var group model.Group
	result = repository.DB.Where("id = ?", groupID).First(&group)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "群聊不存在",
		})
		return
	}

	group.OwnerID = req.NewOwnerID
	result = repository.DB.Save(&group)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新群聊信息失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "群聊转让成功",
	})
}

// RemoveGroupMember 移除群成员
func RemoveGroupMember(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	var req struct {
		UserID uint64 `json:"user_id" binding:"required"`
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

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", 
		groupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限移除群成员",
		})
		return
	}

	// 不能移除群主
	var targetMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, req.UserID).First(&targetMember)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "目标用户不是群成员",
		})
		return
	}

	if targetMember.Role == "owner" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "不能移除群主",
		})
		return
	}

	// 如果操作者不是群主，不能移除管理员
	if groupMember.Role == "admin" && targetMember.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "管理员不能移除其他管理员",
		})
		return
	}

	// 删除群成员
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, req.UserID).Delete(&model.GroupMember{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "移除群成员失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "群成员移除成功",
	})
}

// SetGroupMemberRole 设置群成员角色
func SetGroupMemberRole(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	var req struct {
		UserID uint64 `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required,oneof=admin member"`
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

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", 
		groupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限设置群成员角色",
		})
		return
	}

	// 不能修改群主角色
	var targetMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, req.UserID).First(&targetMember)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "目标用户不是群成员",
		})
		return
	}

	if targetMember.Role == "owner" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "不能修改群主角色",
		})
		return
	}

	// 如果操作者不是群主，不能修改管理员角色
	if groupMember.Role == "admin" && targetMember.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "管理员不能修改其他管理员角色",
		})
		return
	}

	// 更新角色
	targetMember.Role = req.Role
	result = repository.DB.Save(&targetMember)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新群成员角色失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "群成员角色更新成功",
		"member":  targetMember,
	})
}

// SetGroupMute 设置群聊禁言
func SetGroupMute(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseUint(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的群聊ID",
		})
		return
	}

	var req struct {
		UserID uint64 `json:"user_id" binding:"required"`
		Mute   bool   `json:"mute" binding:"required"`
		Reason string `json:"reason"`
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

	// 检查用户是否是群主或管理员
	var groupMember model.GroupMember
	result := repository.DB.Where("group_id = ? AND user_id = ? AND role IN ?", 
		groupID, currentUserID.(uint64), []string{"owner", "admin"}).First(&groupMember)
	if result.Error != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "您没有权限设置群成员禁言",
		})
		return
	}

	// 检查目标用户是否是群成员
	var targetMember model.GroupMember
	result = repository.DB.Where("group_id = ? AND user_id = ?", groupID, req.UserID).First(&targetMember)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "目标用户不是群成员",
		})
		return
	}

	// 如果操作者不是群主，不能对管理员进行禁言
	if groupMember.Role == "admin" && targetMember.Role == "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "管理员不能对其他管理员进行禁言",
		})
		return
	}

	// 设置禁言
	targetMember.IsMute = req.Mute
	if req.Mute {
		now := time.Now()
		targetMember.MuteAt = &now
		targetMember.MuteReason = req.Reason
		targetMember.MuteBy = currentUserID.(uint64)
	} else {
		targetMember.MuteAt = nil
		targetMember.MuteReason = ""
		targetMember.MuteBy = 0
	}

	result = repository.DB.Save(&targetMember)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "设置群成员禁言失败",
		})
		return
	}

	actionText := "解除"
	if req.Mute {
		actionText = "设置"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": actionText + "群成员禁言成功",
	})
}

// SearchGroups 搜索群聊（私有群聊无法被搜索）
func SearchGroups(c *gin.Context) {
	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "搜索关键词不能为空",
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

	// 搜索公开群聊（非私有群聊），按名称模糊匹配
	var groups []model.Group
	err := repository.DB.Where("name LIKE ? AND is_private = ?", "%"+keyword+"%", false).Find(&groups).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "搜索群聊失败",
		})
		return
	}

	// 过滤掉用户已加入的群聊，并添加是否已加入的信息
	var groupData []gin.H
	for _, group := range groups {
		// 检查用户是否已加入该群聊
		var existingMember model.GroupMember
		result := repository.DB.Where("group_id = ? AND user_id = ?", group.ID, currentUserID.(uint64)).First(&existingMember)
		joined := result.Error == nil

		// 获取成员数量
		var memberCount int64
		repository.DB.Model(&model.GroupMember{}).Where("group_id = ?", group.ID).Count(&memberCount)

		groupData = append(groupData, gin.H{
			"id":            group.ID,
			"name":          group.Name,
			"avatar_url":    group.AvatarURL,
			"description":   group.Description,
			"need_approval": group.NeedApproval,
			"member_count":  memberCount,
			"created_at":    group.CreatedAt,
			"joined":        joined, // 标识用户是否已加入该群聊
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"groups": groupData,
		"count":  len(groupData),
	})
}
