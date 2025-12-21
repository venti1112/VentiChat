package main

import (
	"os"
	"path/filepath"

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

	// 测试不同级别的日志
	utils.Debug("这是一条调试日志")
	utils.Infof("这是一条信息日志")
	utils.Warn("这是一条警告日志")
	utils.Error("这是一条错误日志")

	// 确保日志被写入
	utils.Sync()
	
	// TODO: 在这里添加正常的服务器启动逻辑
	// 例如:
	// server.Start()
}