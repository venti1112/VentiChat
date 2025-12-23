package main

import (
	"os"
	"path/filepath"

	"ventichat/internal/app"
	"ventichat/internal/setup"
	"ventichat/internal/utils"
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
	defer utils.Sync()

	// 启动服务器
	if err := app.StartServer(); err != nil {
		utils.Errorf("服务器启动失败: %v", err)
		os.Exit(1)
	}
}
