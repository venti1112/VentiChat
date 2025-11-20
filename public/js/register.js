// 注册页脚本 - 仅在register.html中使用

// 处理注册表单提交
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const userData = {
    username: formData.get('username'),
    nickname: formData.get('nickname'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  };
  
  // 前端验证
  if (userData.password !== userData.confirmPassword) {
    window.showError('两次输入的密码不一致');
    return;
  }
  
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(userData.username)) {
    window.showError('用户名格式不正确');
    return;
  }
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '注册失败');
    }
    
    const result = await response.json();
    
    // 保存token和用户信息到localStorage
    localStorage.setItem('authToken', result.token);
    localStorage.setItem('currentUser', JSON.stringify(result.user));
    
    window.showSuccess('注册成功！请登录');
    
    // 重定向到主页而不是登录页
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    
  } catch (error) {
    window.showError('注册失败：' + error.message);
  }
});