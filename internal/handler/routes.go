package handler

import (
	"ventichat/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes 设置路由
func SetupRoutes(r *gin.Engine) {

	// 注册认证相关路由
	setupAuthRoutes(r)

	// 注册用户相关路由
	setupUserRoutes(r)

	// 注册好友相关路由
	setupFriendRoutes(r)

	// 注册群聊相关路由
	setupGroupRoutes(r)
	
	// 注册消息相关路由
	setupMessageRoutes(r)
	
	// 注册WebSocket相关路由
	setupWebSocketRoutes(r)
}

// 认证相关路由
func setupAuthRoutes(r *gin.Engine) {
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", RegisterUser)
		auth.POST("/login", LoginUser)
		auth.POST("/resend-verification", ResendVerificationEmail)
		auth.POST("/verify-email", VerifyEmail)
		auth.POST("/logout", LogoutUser) // 添加退出登录接口
	}
}

// 用户相关路由
func setupUserRoutes(r *gin.Engine) {
	user := r.Group("/api/users")
	{
		// 公开接口：通过ID获取用户信息
		user.GET("/:id", GetUserByID)
	}
}

// 好友相关路由
func setupFriendRoutes(r *gin.Engine) {
	friend := r.Group("/api/friends")
	friend.Use(middleware.AuthMiddleware())
	{
		friend.GET("", GetFriends)                           // 获取好友列表
		friend.GET("/blocked", GetBlockedFriends)            // 获取被拉黑的好友列表
		friend.POST("/requests", SendFriendRequest)          // 发送好友请求
		friend.GET("/requests", GetFriendRequests)           // 获取好友请求列表
		friend.POST("/requests/handle", HandleFriendRequest) // 处理好友请求（接受/拒绝）
		friend.POST("/:friend_id/unblock", UnblockFriend)    // 解除拉黑好友
		friend.GET("/:friend_id/block", BlockFriend)         // 拉黑好友
		friend.DELETE("/:friend_id", RemoveFriend)           // 删除好友
		friend.GET("/search", SearchUsers)                   // 搜索用户
	}
}

// 群聊相关路由
func setupGroupRoutes(r *gin.Engine) {
	group := r.Group("/api/groups")
	group.Use(middleware.AuthMiddleware())
	{
		group.POST("/create", CreateGroup)                           // 创建群聊
		group.GET("/list", GetGroups)                                // 获取群聊列表
		group.GET("/:group_id/members", GetGroupMembers)             // 获取群聊成员列表
		group.POST("/:group_id/join", JoinGroup)                     // 申请加入群聊
		group.POST("/:group_id/leave", LeaveGroup)                   // 退出群聊
		group.GET("/:group_id/requests", GetGroupRequests)           // 获取群聊申请列表
		group.POST("/request/:request_id/handle", HandleGroupRequest) // 处理群聊申请
		group.PUT("/:group_id", UpdateGroupInfo)                     // 更新群聊信息
		group.PUT("/:group_id/transfer", TransferGroup)              // 转让群聊
		group.POST("/:group_id/remove-member", RemoveGroupMember)    // 移除群成员
		group.POST("/:group_id/set-role", SetGroupMemberRole)        // 设置群成员角色
		group.POST("/:group_id/set-mute", SetGroupMute)              // 设置群成员禁言
		group.GET("/search", SearchGroups)                           // 搜索群聊
	}
}

// 消息相关路由
func setupMessageRoutes(r *gin.Engine) {
	message := r.Group("/api/message")
	message.Use(middleware.AuthMiddleware())
	{
		message.GET("/history/:type/:id", GetChatHistory) // 获取聊天历史
	}
}

// WebSocket相关路由
func setupWebSocketRoutes(r *gin.Engine) {
	ws := r.Group("/ws")
	// 移除认证中间件，因为在WebSocket处理器内部处理认证
	{
		// WebSocket连接 - 需要在WebSocketHandler内部处理跨域和Origin检查
		ws.GET("/connect", func(c *gin.Context) {
			WebSocketHandler(c)
		})
		
		ws.GET("/online-users", GetOnlineUsers)              // 获取在线用户
		ws.GET("/user/:user_id/connections", GetUserConnections) // 获取用户连接信息
	}
}