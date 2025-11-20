# VentiChat API 接口文档

## 1. 概述

本接口文档描述了 VentiChat 实时聊天系统的认证相关 API 接口。所有 API 请求必须包含 `/api` 前缀（如 `/api/auth/login`），否则将被静态文件服务捕获导致 `Unexpected token '<'` 错误。

### 基础信息
- **基础 URL**: `http://localhost:3011`
- **认证方式**: JWT (通过请求体传递)
- **内容类型**: `application/json`

---

## 2. 认证接口

### 2.1 用户登录
**接口说明**: 验证用户凭证并返回 JWT token

#### 请求
- **URL**: `/api/auth/login`
- **方法**: `POST`
- **请求头**:
  ```http
  Content-Type: application/json
  ```
- **请求体**:
  ```json
  {
    "username": "string (必填)",
    "password": "string (必填)"
  }
  ```

#### 响应
- **成功 (200 OK)**:
  ```json
  {
    "message": "登录成功",
    "token": "string (JWT token)",
    "user": {
      "id": "number",
      "username": "string",
      "isAdmin": "boolean"
    }
  }
  ```
- **失败 (401 Unauthorized)**:
  ```json
  {
    "message": "用户名或密码错误"
  }
  ```

---

### 2.2 Token 验证
**接口说明**: 验证 JWT token 的有效性

#### 请求
- **URL**: `/api/auth/verify`
- **方法**: `POST`
- **请求头**:
  ```http
  Content-Type: application/json
  ```
- **请求体**:
  ```json
  {
    "token": "string (必填)"
  }
  ```

#### 响应
- **有效 Token (200 OK)**:
  ```json
  {
    "valid": true,
    "user": {
      "id": "number",
      "username": "string",
      "isAdmin": "boolean"
    }
  }
  ```
- **无效 Token (403 Forbidden)**:
  ```json
  {
    "valid": false,
    "message": "无效的Token"
  }
  ```

---

## 3. PowerShell 测试指南

### 3.1 准备工作
1. 确保应用正在运行:
   ```powershell
   npm run dev
   ```
2. 确认服务已启动（查看控制台输出 `服务器运行在 http://localhost:3011`）

### 3.2 测试登录接口
```powershell
# 测试有效凭证
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3011/api/auth/login" ` -Method Post ` -Body '{"username":"admin", "password":"admin"}' `  -ContentType "application/json"

# 显示返回的token
$loginResponse.token

# 测试无效凭证
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/login" `
  -Method Post `
  -Body '{"username":"invalid", "password":"wrong"}' `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue
```

### 3.3 测试 Token 验证接口
```powershell
# 1. 先获取有效token
$token = (Invoke-RestMethod -Uri "http://localhost:3011/api/auth/login" ` -Method Post ` -Body '{"username":"admin", "password":"admin"}' ` -ContentType "application/json").token

# 2. 验证有效token
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" ` -Method Post ` -Body "{`"token`":`"$token`"}" ` -ContentType "application/json"

# 3. 测试无效token
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" ` -Method Post ` -Body '{"token":"invalid.token.here"}' ` -ContentType "application/json" ` -ErrorAction SilentlyContinue
```
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body '{"token":"invalid.token.here"}' `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue
```

### 3.4 测试常见错误场景
```powershell
# 缺少token字段
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body '{}' `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue

# 错误的Content-Type
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body '{"token":"valid.token"}' `
  -ContentType "text/plain" `
  -ErrorAction SilentlyContinue

# 无效的JSON格式
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body 'invalid json' `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue
```

---

## 4. 注意事项

1. **路径前缀**：所有 API 必须包含 `/api` 前缀，否则将被静态文件服务捕获
   - ✅ 正确: `/api/auth/verify`
   - ❌ 错误: `/auth/verify`

2. **PowerShell 特殊字符处理**：
   - JSON 中的双引号需要转义：`\"`
   - 变量插值使用：`"{`\"token`\":`\"$token`\"}"`

3. **错误处理**：
   - 使用 `-ErrorAction SilentlyContinue` 防止 PowerShell 在 HTTP 错误时中断
   - 403 错误表示认证失败，应检查 token 有效性

4. **安全提示**：
   - 生产环境应使用 HTTPS
   - 不要在日志中记录完整 token
   - 前端应将 token 存储在 `localStorage` 的 `authToken` 字段

---

## 5. 调试技巧

### 查看完整响应（包括状态码）
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body '{"token":"valid.token"}' `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue

# 查看状态码
$response.StatusCode

# 查看响应内容
$response.Content | ConvertFrom-Json
```

### 保存测试结果到文件
```powershell
# 保存有效验证结果
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body "{`"token`":`"$token`"}" `
  -ContentType "application/json" | ConvertTo-Json | Out-File "valid_token_test.json"

# 保存无效验证结果
Invoke-RestMethod -Uri "http://localhost:3011/api/auth/verify" `
  -Method Post `
  -Body '{"token":"invalid"}' `
  -ContentType "application/json" `
  -ErrorVariable err `
  -ErrorAction SilentlyContinue
$err.ErrorDetails.Message | Out-File "invalid_token_test.json"
```