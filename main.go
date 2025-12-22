package main

import (
	"fmt"
	"os"
	"path/filepath"

	"ventichat/internal/setup"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	// 检查配置文件是否存在
	configPath := filepath.Join(".", "config", "config.yaml")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// 配置文件不存在，启动安装向导
		setupCompleted := setup.RunSetup()
		if !setupCompleted {
			// 安装未完成，退出程序
			return
		}
		// 安装已完成，继续执行正常流程
	}

	// 初始化配置
	utils.InitConfig()

	// 初始化日志
	utils.InitLogger()

	// 确保日志被写入
	utils.Sync()

	// 启动Web服务器
	startWebServer()
}

// startWebServer 启动Web服务器
func startWebServer() {
	// 创建Gin引擎
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// 挂载静态文件 - 只需要挂载根目录即可，子目录会自动映射
	router.Static("/", "./web")

	// 启动服务器
	port := utils.AppConfig.Server.Port

	addr := fmt.Sprintf(":%d", port)
	utils.Infof("服务器启动，监听端口 %d", port)
	router.Run(addr)
}
