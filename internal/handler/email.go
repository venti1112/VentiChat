package handler

import (
	"context"
	"fmt"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// ResendVerificationEmail 重发邮箱验证邮件
func ResendVerificationEmail(c *gin.Context) {
	var req struct {
		Identifier string `json:"identifier" binding:"required"` // 用户名/邮箱/手机号
		Password   string `json:"password" binding:"required"`
		NewEmail   string `json:"new_email"` // 可选，用于修改邮箱
	}

	// 绑定请求数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	// 查找用户
	var user model.User
	result := repository.DB.Where("username = ? OR email = ? OR mobile = ?", 
		req.Identifier, req.Identifier, req.Identifier).First(&user)
	if result.Error != nil {
		c.JSON(401, gin.H{
			"error": "用户名、邮箱或手机号不存在",
		})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(401, gin.H{
			"error": "密码错误",
		})
		return
	}

	// 检查用户是否已被封禁
	if user.IsBanned {
		// 检查封禁是否已过期
		if user.BannedTexpires != nil && user.BannedTexpires.After(time.Now()) {
			c.JSON(401, gin.H{
				"error": "账号已被封禁",
			})
			return
		} else if user.BannedTexpires != nil {
			// 封禁已过期，更新数据库状态
			user.IsBanned = false
			repository.DB.Save(&user)
		} else {
			// 永久封禁
			c.JSON(401, gin.H{
				"error": "账号已被永久封禁",
			})
			return
		}
	}

	// 如果提供了新邮箱，更新用户邮箱
	if req.NewEmail != "" {
		// 检查新邮箱是否已被其他用户使用
		var existingUser model.User
		result := repository.DB.Where("email = ?", req.NewEmail).First(&existingUser)
		if result.Error == nil {
			c.JSON(400, gin.H{
				"error": "新邮箱已被其他用户使用",
			})
			return
		}

		// 更新用户邮箱并重置验证状态
		user.Email = req.NewEmail
		user.EmailVerified = false
		result = repository.DB.Save(&user)
		if result.Error != nil {
			c.JSON(500, gin.H{
				"error": "更新邮箱失败",
			})
			return
		}
	}

	// 检查是否已经验证过邮箱
	if user.EmailVerified {
		c.JSON(400, gin.H{
			"error": "邮箱已验证，无需重发验证邮件",
		})
		return
	}

	// 检查邮箱是否为空
	if user.Email == "" {
		c.JSON(400, gin.H{
			"error": "用户邮箱为空，无法发送验证邮件",
		})
		return
	}

	// 生成安全的邮箱验证令牌
	verificationToken, err := utils.GenerateSecureToken()
	if err != nil {
		utils.Errorf("生成邮箱验证令牌失败: %v", err)
		c.JSON(500, gin.H{
			"error": "邮箱验证令牌生成失败",
		})
		return
	}

	// 将验证信息存储到Redis，设置过期时间（30分钟）
	emailVerifyKey := "email_verify:" + verificationToken
	ctx := context.Background()
	err = repository.RDB.SetEX(ctx, emailVerifyKey, fmt.Sprintf("%d", user.ID), 30*time.Minute).Err()
	if err != nil {
		utils.Errorf("存储邮箱验证令牌失败: %v", err)
		c.JSON(500, gin.H{
			"error": "邮箱验证令牌存储失败",
		})
		return
	}

	// 发送验证邮件
	go utils.SendVerificationEmail(user.Email, verificationToken, user.Username)

	c.JSON(200, gin.H{
		"message": "验证邮件已发送，请检查邮箱",
		"email":   user.Email,
	})
}

// VerifyEmail 验证邮箱
func VerifyEmail(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}

	// 绑定请求数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	// 从Redis获取验证信息
	ctx := context.Background()
	userIDStr, err := repository.RDB.Get(ctx, "email_verify:"+req.Token).Result()
	if err != nil {
		c.JSON(400, gin.H{
			"error": "验证链接无效或已过期",
		})
		return
	}

	// 删除验证令牌（一次性使用）
	repository.RDB.Del(ctx, "email_verify:"+req.Token)

	// 将userIDStr转换为uint64
	var userID uint64
	fmt.Sscanf(userIDStr, "%d", &userID)

	// 更新用户验证状态，只更新EmailVerified字段
	result := repository.DB.Model(&model.User{}).Where("id = ?", userID).Update("email_verified", true)
	if result.Error != nil {
		c.JSON(500, gin.H{
			"error": "更新验证状态失败",
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(500, gin.H{
			"error": "用户不存在",
		})
		return
	}

	c.JSON(200, gin.H{
		"message": "邮箱验证成功",
	})
}