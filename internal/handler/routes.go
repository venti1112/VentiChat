package handler

import (
	"ventichat/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes 设置路由
func SetupRoutes(r *gin.Engine) {
	// 注册公开路由
	setupPublicRoutes(r)
	
	// 注册认证相关路由（公开）
	setupAuthRoutes(r)
	
	// 注册受保护的路由组
	setupProtectedRoutes(r)
}

// setupAuthRoutes 设置认证相关路由
func setupAuthRoutes(r *gin.Engine) {
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", RegisterUser)
		auth.POST("/login", LoginUser)
		auth.POST("/resend-verification", ResendVerificationEmail) // 添加重发验证邮件接口
		auth.POST("/verify-email", VerifyEmail) // 添加邮箱验证接口
		// 可以在这里添加其他认证相关路由，如忘记密码等
	}
}

// setupPublicRoutes 设置公开路由
func setupPublicRoutes(r *gin.Engine) {
	r.GET("/api/public", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "公开接口",
		})
	})
}

// setupProtectedRoutes 设置受保护的路由
func setupProtectedRoutes(r *gin.Engine) {
	protected := r.Group("/api/protected")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/profile", func(c *gin.Context) {
			// 从上下文获取用户信息
			userId, _ := c.Get("user_id")
			username, _ := c.Get("username")
			
			c.JSON(200, gin.H{
				"message":  "访问受保护的资源成功",
				"user_id":  userId,
				"username": username,
			})
		})
		
		protected.GET("/admin", func(c *gin.Context) {
			// 检查是否为管理员
			isAdmin, _ := c.Get("is_admin")
			if isAdmin != true {
				c.JSON(403, gin.H{
					"error": "权限不足",
				})
				return
			}
			
			c.JSON(200, gin.H{
				"message": "管理员专用接口",
			})
		})
	}
}