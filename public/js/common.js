/*
 * 公共JavaScript - 在多个页面中共享的功能
 */

// 显示成功消息
window.showSuccess = function(message) {
  const msgDiv = document.getElementById('globalMessage');
  msgDiv.className = 'alert alert-success fixed-top text-center';
  msgDiv.textContent = message;
  msgDiv.style.display = 'block';
  
  setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 3000);
}

// 显示错误消息
window.showError = function(message) {
  const msgDiv = document.getElementById('globalMessage');
  msgDiv.className = 'alert alert-danger fixed-top text-center';
  msgDiv.textContent = message;
  msgDiv.style.display = 'block';
  
  setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 5000);
}

// 检查登录状态和权限
window.checkAuth = function(needAdmin = false) {
  const currentUser = localStorage.getItem('currentUser');
  
  // 如果没有用户信息，则认为未登录
  if (!currentUser) {
    window.location.href = '/login';
    return false;
  }
  
  // 只检查用户信息是否存在，信任服务端对Cookie的验证
  // （页面加载时服务端已验证过Cookie）
  try {
    const user = JSON.parse(currentUser);
    
    // 如果需要管理员权限，检查用户角色
    if (needAdmin) {
      if (!user.isAdmin) {
        alert('您没有访问管理后台的权限');
        window.location.href = '/';
        return false;
      }
    }
    
    return true;
  } catch (e) {
    localStorage.removeItem('currentUser');
    window.location.href = '/login';
    return false;
  }
}

// 验证token有效性
window.verifyToken = async function() {
  try {
    // 从cookie获取token
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    if (!token) {
      throw new Error('未找到token');
    }

    const response = await fetch('/api/auth/verify', {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Token验证失败');
    }
    
    const data = await response.json();
    // 验证通过，确保currentUser信息最新
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    return true;
  } catch (error) {
    console.error('Token验证失败:', error);
    localStorage.removeItem('currentUser');
    window.location.href = '/login';
    return false;
  }
}

// 格式化日期时间显示
window.formatDateTime = function formatDateTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  return date.toLocaleString();
}

// 退出登录
window.logout = async function() {
  if (confirm('确定要退出登录吗？')) {
    try {
      // 调用后端退出登录接口
      const response = await fetch('/api/auth/logout', {method: 'get'});
      
      if (!response.ok) {
        throw new Error('退出登录失败');
      }
      
      // 清除本地存储的认证信息
      res.clearCookie('token', {
            httpOnly: false,
            secure: false,
            sameSite: 'lax'
        });
      
      // 重定向到登录页
	      window.location.href = '/login';
      
    } catch (error) {
      console.error('退出登录错误:', error);
      // 即使后端调用失败，也清除本地存储
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
	      window.location.href = '/login';
    }
  }
}

// 格式化时间显示（相对时间）
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000 && date.getDate() === now.getDate()) return `${Math.floor(diff / 3600000)}小时前`;
  
  return date.toLocaleString();
}