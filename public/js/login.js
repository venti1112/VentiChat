// 登录页脚本 - 仅在login.html中使用

// 处理登录表单提交
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const credentials = {
    username: formData.get('username'),
    password: formData.get('password')
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
    
    // 保存token和用户信息
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl
    }));
    
    showSuccess('登录成功！');
    
    // 重定向到主页面
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
    
  } catch (error) {
    showError('登录失败：' + error.message);
  }
});
