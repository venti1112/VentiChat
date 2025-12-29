package handler

import (
	"context"
	"fmt"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// LoginUser 用户登录
func LoginUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	// 绑定请求数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": "请求数据格式错误",
		})
		return
	}

	// 根据用户名或邮箱查找用户
	var user model.User
	result := repository.DB.Where("username = ? OR email = ?", req.Username, req.Username).First(&user)
	if result.Error != nil {
		c.JSON(401, gin.H{
			"error": "用户名或密码错误",
		})
		return
	}

	// 检查用户是否被封禁
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

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(401, gin.H{
			"error": "用户名或密码错误",
		})
		return
	}

	// 检查邮箱是否已验证（如果服务器要求邮箱验证）
	if utils.AppConfig.Email.Enable && !user.EmailVerified {
		c.JSON(401, gin.H{
			"error": "邮箱未验证，请先验证邮箱",
		})
		return
	}

	// 生成JWT Token
	token, err := generateToken(user.ID, user.Username, user.IsAdmin)
	if err != nil {
		c.JSON(500, gin.H{
			"error": "生成令牌失败",
		})
		return
	}

	// 将Token存储到Redis，设置过期时间
	tokenKey := "token:" + token
	ctx := context.Background()
	expiration := time.Duration(utils.AppConfig.JWT.Expiration) * time.Hour
	err = repository.RDB.SetEX(ctx, tokenKey, fmt.Sprintf("%d", user.ID), expiration).Err()
	if err != nil {
		utils.Errorf("存储令牌失败: %v", err)
		c.JSON(500, gin.H{
			"error": "存储令牌失败",
		})
		return
	}

	// 记录登录记录
	go recordLogin(user.ID, c.ClientIP(), c.GetHeader("User-Agent"))

	c.JSON(200, gin.H{
		"message": "登录成功",
		"token":   token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"is_admin": user.IsAdmin,
		},
	})
}

// generateToken 生成JWT Token
func generateToken(userID uint64, username string, isAdmin bool) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  userID,
		"username": username,
		"is_admin": isAdmin,
		"exp":      time.Now().Add(time.Duration(utils.AppConfig.JWT.Expiration) * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 使用配置中的密钥签名
	signedToken, err := token.SignedString([]byte(utils.AppConfig.JWT.Key))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

// recordLogin 记录登录信息
func recordLogin(userID uint64, ip, userAgent string) {
	loginRecord := model.LoginRecord{
		UserID:    userID,
		IP:        ip,
		UserAgent: userAgent,
	}

	result := repository.DB.Create(&loginRecord)
	if result.Error != nil {
		utils.Errorf("记录登录信息失败: %v", result.Error)
	}
}

// LogoutUser 用户退出登录
func LogoutUser(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	
	if authHeader == "" {
		c.JSON(401, gin.H{
			"error": "缺少认证头",
		})
		return
	}
	
	// 提取Bearer token
	var tokenString string
	if len(authHeader) >= 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	} else {
		c.JSON(401, gin.H{
			"error": "认证头格式错误",
		})
		return
	}
	
	// 验证JWT令牌
	_, err := validateToken(tokenString)  // 使用_忽略claims，因为我们只关心令牌是否有效
	if err != nil {
		c.JSON(401, gin.H{
			"error": "无效的令牌",
		})
		return
	}
	
	// 从Redis中删除该令牌
	tokenKey := "token:" + tokenString
	ctx := context.Background()
	err = repository.RDB.Del(ctx, tokenKey).Err()
	if err != nil {
		utils.Errorf("删除令牌失败: %v", err)
		c.JSON(500, gin.H{
			"error": "删除令牌失败",
		})
		return
	}
	
	c.JSON(200, gin.H{
		"message": "退出登录成功",
	})
}
