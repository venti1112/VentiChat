VentiChat// 个人中心页脚本 - 仅在profile.html中使用


// 全局变量
let currentUserId = null;
let currentUserData = null;

// DOM元素引用
const profileForm = document.getElementById('profileForm');
const avatarInput = document.getElementById('avatarInput');
const currentAvatar = document.getElementById('currentAvatar');

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 页面加载时自动验证token
  if (!(await verifyToken())) return;

  // 从localStorage获取当前用户信息
  currentUserData = JSON.parse(localStorage.getItem('currentUser'));
  currentUserId = currentUserData.id;
  
  loadProfileData();
  setupProfileForm();
});

// 设置事件监听器
function setupEventListeners() {
  // 表单提交
  profileForm.addEventListener('submit', updateProfile);
  
  // 重置按钮
  document.getElementById('resetBtn').addEventListener('click', resetForm);
  
  // 退出登录
  document.getElementById('logoutBtn').addEventListener('click', window.logout);
  
  // 头像上传
  avatarInput.addEventListener('change', handleAvatarUpload);
  
  // 密码验证
  document.getElementById('confirmPassword').addEventListener('blur', validatePasswords);
  document.getElementById('newPassword').addEventListener('blur', validatePasswords);
}

// 加载用户信息
async function loadUserProfile() {
  // 从localStorage获取用户信息
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      currentUserData = userData;
      
      // 填充表单
      document.getElementById('username').value = userData.username;
      document.getElementById('nickname').value = userData.nickname || userData.username;
      document.getElementById('uid').value = userData.id;
      if (userData.avatarUrl) {
        currentAvatar.src = userData.avatarUrl;
      }
      return;
    } catch (e) {
      console.error('解析用户信息失败:', e);
    }
  }
  
  // 如果没有本地数据，使用默认值
  const defaultUser = {
    id: '1001',
    username: 'user_' + Date.now(),
    nickname: '新用户',
    avatarUrl: 'https://via.placeholder.com/120'
  };
  
  // 填充表单
  document.getElementById('username').value = defaultUser.username;
  document.getElementById('nickname').value = defaultUser.nickname;
  document.getElementById('uid').value = defaultUser.id;
  if (defaultUser.avatarUrl) {
    currentAvatar.src = defaultUser.avatarUrl;
  }
}

// 加载个人资料
function loadProfileData() {
  fetch('/api/users/profile')
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(user => {
      document.getElementById('currentAvatar').src = user.avatarUrl;
      document.getElementById('avatarPreview').src = user.avatarUrl;
      document.getElementById('username').textContent = user.username;
      document.getElementById('nickname').value = user.nickname || '';
      document.getElementById('bio').value = user.bio || '';
      document.getElementById('registrationDate').textContent = formatDateTime(user.createdAt);
      
      // 设置用户ID到表单
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        form.dataset.userId = user.id;
      });
    })
    .catch(error => {
      console.error('加载个人资料失败:', error);
      window.showError('加载资料失败：' + error.message);
    });
}

// 更新个人资料
async function updateProfile(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const userData = {
    nickname: formData.get('nickname'),
    bio: formData.get('bio')
  };
  
  try {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '更新失败');
    }
    
    window.showSuccess('资料更新成功！');
    
    // 刷新页面数据
    loadProfileData();
    
  } catch (error) {
    window.showError('更新失败：' + error.message);
  }
}

// 处理头像上传
async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // 验证文件类型
  if (!file.type.match('image.*')) {
    window.showError('请选择图片文件');
    avatarInput.value = '';
    return;
  }
  
  // 验证文件大小（限制5MB）
  if (file.size > 5 * 1024 * 1024) {
    window.showError('图片大小不能超过5MB');
    avatarInput.value = '';
    return;
  }
  
  // 预览新头像
  const reader = new FileReader();
  reader.onload = function(e) {
    currentAvatar.src = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // 上传到服务器
  const formData = new FormData();
  formData.append('avatar', file);
  
  try {
    const response = await fetch('/api/users/avatar', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '上传失败');
    }
    
    const result = await response.json();
    window.showSuccess('头像更新成功！');
    
    // 更新页面显示
    currentAvatar.src = result.avatarUrl;
    
  } catch (error) {
    window.showError('头像上传失败：' + error.message);
    // 如果上传失败，恢复原来的头像
    loadUserProfile();
  }
}

// 验证密码
function validatePasswords() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    document.getElementById('confirmPassword').setCustomValidity('密码不匹配');
  } else {
    document.getElementById('confirmPassword').setCustomValidity('');
  }
}

// 重置表单
function resetForm() {
  // 重新加载用户信息
  loadUserProfile();
  
  // 清空密码字段
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  
  // 清空头像输入
  avatarInput.value = '';
}

// 修改密码
async function changePassword(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const oldPassword = formData.get('oldPassword');
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');
  
  // 验证输入
  if (!oldPassword || !newPassword || !confirmPassword) {
    window.showError('请填写所有字段');
    return;
  }
  
  if (newPassword.length < 6) {
    window.showError('新密码至少需要6位字符');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    window.showError('两次输入的新密码不一致');
    return;
  }
  
  try {
    const response = await fetch('/api/users/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '修改失败');
    }
    
    window.showSuccess('密码修改成功！');
    
    // 重置表单
    e.target.reset();
    
  } catch (error) {
    window.showError('密码修改失败：' + error.message);
  }
}