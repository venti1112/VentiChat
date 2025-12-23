package app

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ventichat/internal/handler"
	"ventichat/internal/repository"
	"ventichat/internal/utils"

	"github.com/gin-gonic/gin"
)

// StartServer 启动服务器
func StartServer() error {
	// 初始化数据库连接
	if err := repository.InitDatabase(); err != nil {
		return fmt.Errorf("初始化数据库失败: %v", err)
	}
	utils.Info("数据库连接成功")

	// 初始化Redis连接
	if err := repository.InitRedis(); err != nil {
		return fmt.Errorf("初始化Redis失败: %v", err)
	}
	utils.Info("Redis连接成功")

	// 设置Gin模式
	if utils.AppConfig.Server.Level == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建Gin引擎
	router := gin.Default()

	// 注册路由 - 重要：先注册API路由，再注册静态文件路由
	handler.SetupRoutes(router)

	// 挂载静态文件 - 放在路由注册之后，避免与API路由冲突
	// 使用更具体的路径，避免与API路由冲突
	router.Static("/static", "./web/static")
	router.Static("/images", "./web/images")
	router.Static("/css", "./web/css")
	router.Static("/js", "./web/js")
	router.Static("/fonts", "./web/fonts")
	router.Static("/default", "./web/default")
	
	// 为根路径和各种页面提供静态文件服务
	router.StaticFile("/", "./web/index.html")
	router.StaticFile("/register", "./web/register.html")
	router.StaticFile("/login", "./web/login.html")
	router.StaticFile("/resend-verification", "./web/resend-verification.html")
	router.StaticFile("/verify-email", "./web/verify-email.html")

	// 启动HTTP服务器
	port := utils.AppConfig.Server.Port
	addr := fmt.Sprintf(":%d", port)

	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	utils.Infof("服务器启动，监听端口 %d", port)

	// 在goroutine中启动服务器
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			utils.Errorf("服务器启动失败: %v", err)
		}
	}()

	// 等待中断信号以优雅地关闭服务器
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	utils.Info("正在关闭服务器...")

	// 创建关闭上下文，用于超时控制
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 优雅地关闭服务器
	if err := server.Shutdown(ctx); err != nil {
		utils.Errorf("服务器关闭失败: %v", err)
		return err
	}

	utils.Info("服务器已关闭")
	return nil
}