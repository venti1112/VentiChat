// 登录页脚本 - 仅在login.html中使用

// 处理登录表单提交
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const credentials = {
    username: formData.get('username'),
    password: formData.get('password'),
    rememberMe: document.getElementById('rememberMe')?.checked || false // 添加rememberMe参数
  };
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '登录失败');
    }
    
    const { token, user } = await response.json();
    
    // 保存用户信息
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    }));

    // 登录成功，跳转到主页
    window.location.href = '/';
  } catch (error) {
    window.showError(error.message);
  }
});

