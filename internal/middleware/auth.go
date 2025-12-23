package middleware

import (
	"context"
	"strings"
	"time"

	"ventichat/internal/repository"
	"ventichat/internal/model"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/go-redis/redis/v8"
)

// AuthMiddleware 身份验证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头中获取Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{
				"error": "请提供访问令牌",
			})
			c.Abort()
			return
		}

		// 解析Token格式 "Bearer <token>"
		var tokenString string
		if parts := strings.SplitN(authHeader, " ", 2); len(parts) == 2 && parts[0] == "Bearer" {
			tokenString = parts[1]
		} else {
			c.JSON(401, gin.H{
				"error": "无效的令牌格式",
			})
			c.Abort()
			return
		}

		// 验证Token是否有效
		claims, err := validateToken(tokenString)
		if err != nil {
			c.JSON(401, gin.H{
				"error": "无效的访问令牌",
			})
			c.Abort()
			return
		}

		// 从Redis获取用户ID
		userIdKey := "token:" + tokenString
		userIdStr, err := repository.RDB.Get(context.Background(), userIdKey).Result()
		if err != nil {
			if err == redis.Nil {
				c.JSON(401, gin.H{
					"error": "令牌无效或已过期",
				})
			} else {
				utils.Errorf("从Redis获取用户ID失败: %v", err)
				c.JSON(500, gin.H{
					"error": "服务器内部错误",
				})
			}
			c.Abort()
			return
		}

		// 检查用户是否被封禁
		userID := utils.StringToUint64(userIdStr)
		if isUserBanned(userID) {
			// 从Redis删除Token
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				
				if err := repository.RDB.Del(ctx, userIdKey).Err(); err != nil {
					utils.Errorf("删除被封禁用户的Token失败: %v", err)
				}
			}()
			
			c.JSON(401, gin.H{
				"error": "账号已被封禁",
			})
			c.Abort()
			return
		}

		// 将用户ID和权限信息添加到上下文中
		c.Set("user_id", userID)
		c.Set("username", claims.Username)
		c.Set("is_admin", claims.IsAdmin)

		c.Next()
	}
}

// Claims JWT声明结构
type Claims struct {
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// validateToken 验证JWT Token
func validateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(utils.AppConfig.JWT.Key), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, err
	}

	return claims, nil
}

// isUserBanned 检查用户是否被封禁
func isUserBanned(userID uint64) bool {
	var user model.User
	result := repository.DB.First(&user, userID)
	if result.Error != nil {
		utils.Errorf("查询用户信息失败: %v", result.Error)
		return true // 如果查询失败，为安全起见，视为被封禁
	}

	// 检查是否被封禁
	if user.IsBanned {
		// 检查封禁是否已过期
		if user.BannedTexpires != nil && user.BannedTexpires.After(time.Now()) {
			// 封禁未过期
			return true
		} else if user.BannedTexpires != nil {
			// 封禁已过期，更新数据库状态
			user.IsBanned = false
			repository.DB.Save(&user)
			return false
		} else {
			// 永久封禁
			return true
		}
	}

	return false
}