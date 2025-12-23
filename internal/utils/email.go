package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"gopkg.in/gomail.v2"
)

// GenerateSecureToken 生成安全的验证令牌
func GenerateSecureToken() (string, error) {
	// 生成32字节的随机数据
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	
	// 将随机数据编码为base64字符串
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// SendVerificationEmail 发送验证邮件
func SendVerificationEmail(email, token, username string) {
	m := gomail.NewMessage()
	m.SetHeader("From", AppConfig.Email.From)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "VentiChat邮箱验证")

	// 构建验证链接，指向新的验证页面
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", 
		AppConfig.Server.Host, 
		token,
	)

	// 邮件内容
	body := fmt.Sprintf(`
		<h2>VentiChat邮箱验证</h2>
		<p>您好 %s，</p>
		<p>感谢您使用VentiChat账户。</p>
		<p>请点击以下链接完成邮箱验证：</p>
		<p><a href="%s" target="_blank">点击验证邮箱</a></p>
		<p>或者将以下链接复制到浏览器中打开：</p>
		<p>%s</p>
		<p>此链接将在30分钟内有效。</p>
		<hr>
		<p><em>此邮件由系统自动发送，请勿回复。</em></p>
	`, username, verifyURL, verifyURL)

	m.SetBody("text/html", body)

	// 创建邮件客户端
	dialer := gomail.NewDialer(
		AppConfig.Email.Host,
		AppConfig.Email.Port,
		AppConfig.Email.User,
		AppConfig.Email.Password,
	)

	// 如果启用SSL/TLS
	if AppConfig.Email.Secure {
		dialer.SSL = true
	}

	// 发送邮件
	if err := dialer.DialAndSend(m); err != nil {
		Errorf("发送验证邮件失败: %v", err)
	}
}