package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"ventichat/internal/model"
	"ventichat/internal/repository"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/golang-jwt/jwt/v5"
	"github.com/go-redis/redis/v8"
)

// 定义消息结构
type WebSocketMessage struct {
	Type      string      `json:"type"`      // 消息类型
	Payload   interface{} `json:"payload"`   // 消息内容
	Timestamp time.Time   `json:"timestamp"` // 时间戳
}

// 定义聊天消息结构
type ChatMessage struct {
	MessageID    uint64    `json:"message_id"`
	SenderID     uint64    `json:"sender_id"`
	SenderName   string    `json:"sender_name"`
	ReceiverType string    `json:"receiver_type"` // 'user' 或 'group'
	ReceiverID   uint64    `json:"receiver_id"`
	Content      string    `json:"content"`
	MessageType  string    `json:"message_type"` // 'text', 'image', 'file' 等
	FileURL      string    `json:"file_url,omitempty"`
	FileName     string    `json:"file_name,omitempty"`
	FileSize     int64     `json:"file_size,omitempty"`
	SentAt       time.Time `json:"sent_at"`
}

// 定义连接管理器
type ClientManager struct {
	clients    map[*Client]bool
	broadcast  chan WebSocketMessage
	register   chan *Client
	unregister chan *Client
	groups     map[uint64]map[*Client]bool // 群组中的客户端
	mutex      sync.RWMutex
}

// 客户端结构
type Client struct {
	conn    *websocket.Conn
	send    chan []byte
	userID  uint64
	manager *ClientManager
}

// JWT声明结构
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

var Manager = ClientManager{
	clients:    make(map[*Client]bool),
	broadcast:  make(chan WebSocketMessage),
	register:   make(chan *Client),
	unregister: make(chan *Client),
	groups:     make(map[uint64]map[*Client]bool),
}

// 运行管理器
func (manager *ClientManager) Start() {
	for {
		select {
		case conn := <-manager.register:
			manager.mutex.Lock()
			manager.clients[conn] = true
			manager.mutex.Unlock()

		case conn := <-manager.unregister:
			manager.mutex.Lock()
			if _, ok := manager.clients[conn]; ok {
				delete(manager.clients, conn)
				close(conn.send)

				// 从所有群组中移除客户端
				for groupID, clients := range manager.groups {
					if _, ok := clients[conn]; ok {
						delete(clients, conn)
						if len(clients) == 0 {
							delete(manager.groups, groupID)
						}
					}
				}
			}
			manager.mutex.Unlock()

		case message := <-manager.broadcast:
			manager.mutex.RLock()
			for conn := range manager.clients {
				select {
				case conn.send <- message.Encode():
				default:
					close(conn.send)
					delete(manager.clients, conn)
				}
			}
			manager.mutex.RUnlock()
		}
	}
}

// 发送消息到特定群组
func (manager *ClientManager) SendGroupMessage(groupID uint64, message WebSocketMessage) {
	manager.mutex.RLock()
	clients, ok := manager.groups[groupID]
	if ok {
		for conn := range clients {
			select {
			case conn.send <- message.Encode():
			default:
				close(conn.send)
				delete(manager.clients, conn)
			}
		}
	}
	manager.mutex.RUnlock()
}

// 添加客户端到群组
func (manager *ClientManager) AddToGroup(groupID uint64, client *Client) {
	manager.mutex.Lock()
	if manager.groups[groupID] == nil {
		manager.groups[groupID] = make(map[*Client]bool)
	}
	manager.groups[groupID][client] = true
	manager.mutex.Unlock()
}

// 从群组移除客户端
func (manager *ClientManager) RemoveFromGroup(groupID uint64, client *Client) {
	manager.mutex.Lock()
	if manager.groups[groupID] != nil {
		delete(manager.groups[groupID], client)
		if len(manager.groups[groupID]) == 0 {
			delete(manager.groups, groupID)
		}
	}
	manager.mutex.Unlock()
}

// WebSocket连接处理
func WebSocketHandler(c *gin.Context) {
	// 升级HTTP连接为WebSocket连接
	var upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// 在生产环境中，应该更严格地验证来源
			return true
		},
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 从请求头或查询参数获取JWT令牌
	var tokenString string
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else {
		// 也可以从查询参数获取
		tokenString = c.Query("token")
	}

	if tokenString == "" {
		log.Println("WebSocket连接缺少认证令牌")
		return
	}

	// 验证JWT令牌
	_, tokenErr := validateToken(tokenString)  // 修改：使用新的变量名避免冲突
	if tokenErr != nil {
		log.Printf("WebSocket连接令牌验证失败: %v", tokenErr)
		return
	}

	// 从Redis获取用户ID，验证令牌是否仍然有效
	userIdKey := "token:" + tokenString
	userIdStr, err := repository.RDB.Get(context.Background(), userIdKey).Result()  // 这里可以使用:=，因为需要接收两个返回值
	if err != nil {
		if err == redis.Nil {
			log.Println("WebSocket连接令牌无效或已过期")
		} else {
			log.Printf("WebSocket连接从Redis获取用户ID失败: %v", err)
		}
		return
	}

	userID := utils.StringToUint64(userIdStr)

	client := &Client{
		conn:    conn,
		send:    make(chan []byte, 256),
		userID:  userID,
		manager: &Manager,
	}

	client.manager.register <- client

	// 启动写入goroutine
	go client.writePump()

	// 启动读取goroutine
	go client.readPump()
}

// 写入数据到WebSocket
func (client *Client) writePump() {
	defer func() {
		client.manager.unregister <- client
		client.conn.Close()
	}()

	for message := range client.send {
		client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		w, err := client.conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		if err := w.Close(); err != nil {
			return
		}
	}
}

// 从WebSocket读取数据
func (client *Client) readPump() {
	defer func() {
		client.manager.unregister <- client
		client.conn.Close()
	}()

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			break
		}

		var wsMessage WebSocketMessage
		if err := json.Unmarshal(message, &wsMessage); err != nil {
			continue
		}

		// 处理不同类型的消息
		switch wsMessage.Type {
		case "join_group":
			// 用户加入群聊房间
			if groupID, ok := wsMessage.Payload.(float64); ok {
				client.manager.AddToGroup(uint64(groupID), client)
			}
		case "leave_group":
			// 用户离开群聊房间
			if groupID, ok := wsMessage.Payload.(float64); ok {
				client.manager.RemoveFromGroup(uint64(groupID), client)
			}
		case "send_message":
			// 发送消息
			payloadBytes, _ := json.Marshal(wsMessage.Payload)
			var chatMsg ChatMessage
			if err := json.Unmarshal(payloadBytes, &chatMsg); err != nil {
				continue
			}

			// 验证消息是否是发送给当前用户或当前用户所在的群组
			if chatMsg.ReceiverType == "user" {
				// 私聊：检查当前用户是否是接收者或发送者
				if client.userID != chatMsg.ReceiverID && client.userID != chatMsg.SenderID {
					continue
				}
			} else if chatMsg.ReceiverType == "group" {
				// 群聊：检查用户是否在群组中
				var groupMember model.GroupMember
				result := repository.DB.Where("group_id = ? AND user_id = ?", chatMsg.ReceiverID, client.userID).First(&groupMember)
				if result.Error != nil {
					continue // 用户不在群组中
				}
			} else {
				continue // 无效的消息类型
			}

			// 保存消息到数据库
			messageModel := model.Message{
				SenderID:     chatMsg.SenderID,
				ReceiverType: chatMsg.ReceiverType,
				ReceiverID:   chatMsg.ReceiverID,
				MessageType:  chatMsg.MessageType,
				Content:      chatMsg.Content,
				FileURL:      chatMsg.FileURL,
				FileName:     chatMsg.FileName,
				FileSize:     chatMsg.FileSize,
			}

			result := repository.DB.Create(&messageModel)
			if result.Error != nil {
				continue
			}

			// 更新消息ID和时间
			chatMsg.MessageID = messageModel.ID
			chatMsg.SentAt = messageModel.SentAt

			// 获取发送者用户名
			var sender model.User
			repository.DB.Select("id, username, nickname").Where("id = ?", client.userID).First(&sender)
			if sender.Nickname != "" {
				chatMsg.SenderName = sender.Nickname
			} else {
				chatMsg.SenderName = sender.Username
			}

			// 构造返回的消息
			returnMsg := WebSocketMessage{
				Type:      "new_message",
				Payload:   chatMsg,
				Timestamp: time.Now(),
			}

			// 发送消息
			if chatMsg.ReceiverType == "group" {
				client.manager.SendGroupMessage(chatMsg.ReceiverID, returnMsg)
			} else {
				// 私聊：发送给发送者和接收者
				client.manager.broadcast <- returnMsg
			}
		}
	}
}

// 编码WebSocket消息
func (wsMessage *WebSocketMessage) Encode() []byte {
	data, err := json.Marshal(wsMessage)
	if err != nil {
		return []byte{}
	}
	return data
}

// 获取聊天历史
func GetChatHistory(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未授权访问",
		})
		return
	}

	// 从路径参数获取聊天类型和目标ID
	receiverType := c.Param("type")
	receiverIDStr := c.Param("id")

	if receiverType == "" || receiverIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少必要参数",
		})
		return
	}

	receiverID, err := strconv.ParseUint(receiverIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的接收者ID",
		})
		return
	}

	// 验证用户是否有权限查看聊天历史
	switch receiverType {
	case "user":
		// 私聊：验证用户是否是对话的参与者
		var count int64
		repository.DB.Model(&model.Message{}).
			Where("(sender_id = ? AND receiver_id = ? AND receiver_type = ?) OR (sender_id = ? AND receiver_id = ? AND receiver_type = ?)",
				userID.(uint64), receiverID, receiverType,
				receiverID, userID.(uint64), receiverType).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "无权限访问此聊天记录",
			})
			return
		}
	case "group":
		// 群聊：验证用户是否在群组中
		var groupMember model.GroupMember
		result := repository.DB.Where("group_id = ? AND user_id = ?", receiverID, userID.(uint64)).First(&groupMember)
		if result.Error != nil {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "您不在该群组中",
			})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的接收者类型",
		})
		return
	}

	// 获取聊天记录
	var messages []model.Message
	err = repository.DB.Where(
		"((sender_id = ? AND receiver_id = ? AND receiver_type = ?) OR (sender_id = ? AND receiver_id = ? AND receiver_type = ?)) OR (receiver_type = 'group' AND receiver_id = ?)",
		userID.(uint64), receiverID, receiverType,
		receiverID, userID.(uint64), receiverType,
		receiverID,
	).Order("sent_at ASC").Find(&messages).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取聊天记录失败",
		})
		return
	}

	// 转换为前端需要的格式
	var chatHistory []ChatMessage
	for _, msg := range messages {
		var senderName string
		var sender model.User
		repository.DB.Select("id, username, nickname").Where("id = ?", msg.SenderID).First(&sender)
		if sender.Nickname != "" {
			senderName = sender.Nickname
		} else {
			senderName = sender.Username
		}

		chatHistory = append(chatHistory, ChatMessage{
			MessageID:    msg.ID,
			SenderID:     msg.SenderID,
			SenderName:   senderName,
			ReceiverType: msg.ReceiverType,
			ReceiverID:   msg.ReceiverID,
			Content:      msg.Content,
			MessageType:  msg.MessageType,
			FileURL:      msg.FileURL,
			FileName:     msg.FileName,
			FileSize:     msg.FileSize,
			SentAt:       msg.SentAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": chatHistory,
	})
}

// 获取在线用户列表
func GetOnlineUsers(c *gin.Context) {
	Manager.mutex.RLock()
	defer Manager.mutex.RUnlock()

	// 获取所有连接的用户ID
	onlineUsers := make(map[uint64]bool)
	for client := range Manager.clients {
		onlineUsers[client.userID] = true
	}

	// 获取用户详细信息
	var users []model.User
	userIDs := make([]uint64, 0, len(onlineUsers))
	for userID := range onlineUsers {
		userIDs = append(userIDs, userID)
	}

	if len(userIDs) > 0 {
		repository.DB.Select("id, username, nickname, avatar_url").Where("id IN ?", userIDs).Find(&users)
	}

	// 格式化返回数据
	onlineUserList := make([]gin.H, len(users))
	for i, user := range users {
		onlineUserList[i] = gin.H{
			"id":         user.ID,
			"username":   user.Username,
			"nickname":   user.Nickname,
			"avatar_url": user.AvatarURL,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"online_users": onlineUserList,
		"count":        len(onlineUserList),
	})
}

// 获取用户连接信息
func GetUserConnections(c *gin.Context) {
	userIDStr := c.Param("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少用户ID参数",
		})
		return
	}

	userID := utils.StringToUint64(userIDStr)
	if userID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的用户ID",
		})
		return
	}

	Manager.mutex.RLock()
	defer Manager.mutex.RUnlock()

	// 获取指定用户的所有连接
	var connections []gin.H
	for client := range Manager.clients {
		if client.userID == userID {
			connections = append(connections, gin.H{
				"connection_id": client.conn.RemoteAddr().String(),
				"connected_at":  time.Now(), // 实际应该记录连接时间
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":     userID,
		"connections": connections,
		"count":       len(connections),
	})
}
