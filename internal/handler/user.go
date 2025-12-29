package handler

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// RegisterUser 注册用户
func RegisterUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Nickname string `json:"nickname" binding:"required"`
		Password string `json:"password" binding:"required"`
		Email    string `json:"email"`
		Mobile   string `json:"mobile"`
	}

	// 绑定请求数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	// 验证必要字段
	if req.Username == "" || req.Nickname == "" || req.Password == "" {
		c.JSON(400, gin.H{
			"error": "用户名、昵称和密码不能为空",
		})
		return
	}

	// 如果服务器开启邮箱验证，验证邮箱是否存在
	if utils.AppConfig.Email.Enable {
		if req.Email == "" {
			c.JSON(400, gin.H{
				"error": "邮箱不能为空",
			})
			return
		}
	}

	// 验证用户名、邮箱、手机号是否重复
	var existingUser model.User
	if req.Username != "" {
		result := repository.DB.Where("username = ?", req.Username).First(&existingUser)
		if result.Error == nil {
			c.JSON(400, gin.H{
				"error": "用户名已存在",
			})
			return
		}
	}

	if req.Email != "" {
		result := repository.DB.Where("email = ?", req.Email).First(&existingUser)
		if result.Error == nil {
			c.JSON(400, gin.H{
				"error": "邮箱已存在",
			})
			return
		}
	}

	if req.Mobile != "" {
		result := repository.DB.Where("mobile = ?", req.Mobile).First(&existingUser)
		if result.Error == nil {
			c.JSON(400, gin.H{
				"error": "手机号已存在",
			})
			return
		}
	}

	// 验证密码强度
	if !validatePassword(req.Password) {
		c.JSON(400, gin.H{
			"error": "密码强度不够，必须至少8位且包含小写字母、大写字母、数字和特殊符号",
		})
		return
	}

	// 对密码进行哈希处理
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(500, gin.H{
			"error": "密码加密失败",
		})
		return
	}

	// 创建新用户
	newUser := model.User{
		Username:      req.Username,
		Nickname:      req.Nickname,
		PasswordHash:  string(hashedPassword),
		Email:         req.Email,
		Mobile:        req.Mobile,
		EmailVerified: false, // 默认未验证
		IsBanned:      false,
		IsFreepass:    false,
	}

	// 保存用户到数据库
	result := repository.DB.Create(&newUser)
	if result.Error != nil {
		c.JSON(500, gin.H{
			"error": "用户创建失败",
		})
		return
	}

	// 检查是否需要邮箱验证
	if utils.AppConfig.Email.Enable && req.Email != "" {
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
		err = repository.RDB.SetEX(ctx, emailVerifyKey, fmt.Sprintf("%d", newUser.ID), 30*time.Minute).Err()
		if err != nil {
			utils.Errorf("存储邮箱验证令牌失败: %v", err)
			c.JSON(500, gin.H{
				"error": "邮箱验证令牌存储失败",
			})
			return
		}

		// 发送验证邮件
		go utils.SendVerificationEmail(req.Email, verificationToken, req.Username)

		c.JSON(200, gin.H{
			"message":    "用户注册成功，请检查邮箱完成验证",
			"user_id":    newUser.ID,
			"email_sent": true,
			"email":      req.Email,
		})
	} else {
		c.JSON(200, gin.H{
			"message": "用户注册成功",
			"user_id": newUser.ID,
		})
	}
}

// validatePassword 验证密码强度
func validatePassword(password string) bool {
	// 检查长度至少为8位
	if len(password) < 8 {
		return false
	}

	// 检查是否包含小写字母
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	// 检查是否包含大写字母
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	// 检查是否包含数字
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(password)
	// 检查是否包含特殊符号
	hasSpecial := regexp.MustCompile(`[^a-zA-Z0-9]`).MatchString(password)

	return hasLower && hasUpper && hasDigit && hasSpecial
}

// GetUserByID 根据用户ID获取用户信息
func GetUserByID(c *gin.Context) {
	// 从路径参数获取用户ID
	userIDStr := c.Param("id")
	
	// 检查是否为"null"或空值
	if userIDStr == "" || userIDStr == "null" {
		c.JSON(400, gin.H{
			"error": "用户ID无效",
		})
		return
	}
	
	userID := utils.StringToUint64(userIDStr)
	if userID == 0 {
		c.JSON(400, gin.H{
			"error": "用户ID无效",
		})
		return
	}

	// 从数据库查询用户
	var user model.User
	result := repository.DB.Select([]string{
		"id", "username", "nickname", "email", "mobile", "introduction", 
		"avatar_url", "theme_color", "background_url", "language", "created_at",
	}).Where("id = ?", userID).First(&user)
	
	if result.Error != nil {
		if result.Error.Error() == "record not found" {
			c.JSON(404, gin.H{
				"error": "用户不存在",
			})
		} else {
			c.JSON(500, gin.H{
				"error": "查询用户失败",
			})
		}
		return
	}

	// 如果用户被封禁，但请求的是当前登录用户，则仍然返回用户信息
	// 否则，如果用户被封禁登录，则不返回用户信息
	if user.IsBanned {
		c.JSON(404, gin.H{
			"error": "用户不存在",
		})
		return
	}

	// 返回用户信息，不包含敏感信息
	c.JSON(200, gin.H{
		"user": user,
	})
}
