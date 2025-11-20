// 管理后台页脚本 - 仅在admin.html中使用


// 全局变量
let currentUserId = null;
let currentUserData = null;

// DOM元素引用
const usersTableBody = document.getElementById('usersTableBody');
const roomsTableBody = document.getElementById('roomsTableBody');

// 状态变量
let loadingUsers = false;
let loadingRooms = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  if (!window.checkAuth()) return;
  
  // 从localStorage获取当前用户信息
  currentUserData = JSON.parse(localStorage.getItem('currentUser'));
  currentUserId = currentUserData.id;
  
  loadUsers();
  loadRooms();
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  // 表单提交
  document.getElementById('settingsForm').addEventListener('submit', updateSettings);
  document.getElementById('addUserForm').addEventListener('submit', addUser);
  document.getElementById('editUserForm').addEventListener('submit', editUser);
  
  // 按钮点击
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('cleanupRoomsBtn').addEventListener('click', cleanupRooms);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
  
  // 搜索功能
  document.getElementById('searchUsers').addEventListener('input', filterUsers);
  document.getElementById('filterStatus').addEventListener('change', filterUsers);
  document.getElementById('searchRooms').addEventListener('input', filterRooms);
  document.getElementById('filterRoomType').addEventListener('change', filterRooms);
  
  // 解散聊天室确认
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteRoom);
}

// 加载管理数据
async function loadAdminData() {
  try {
    // 加载用户列表
    loadUsers();
    
    // 加载聊天室列表
    loadRooms();
    
    // 加载系统设置
    loadSettings();
    
  } catch (error) {
    window.showError('加载管理数据失败：' + error.message);
  }
}

// 加载用户列表
function loadUsers() {
  fetch('/api/admin/users')
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(users => {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = '';
      
      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${user.id}</td>
          <td>${user.username}</td>
          <td>${user.nickname}</td>
          <td><img src="${user.avatarUrl}" alt="头像" class="avatar" style="width: 30px; height: 30px;"></td>
          <td>
            <span class="badge ${user.status === 'active' ? 'status-active' : 'status-banned'}">
              ${user.status === 'active' ? '正常' : '封禁'}
            </span>
          </td>
          <td>${formatDateTime(user.createdAt)}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-sm btn-primary" onclick="openEditUserModal(${JSON.stringify(user)})" title="编辑"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm ${user.status === 'active' ? 'btn-warning' : 'btn-success'}" 
                      onclick="toggleUserStatus(${user.id}, '${user.status}')" 
                      title="${user.status === 'active' ? '封禁' : '解封'}">
                <i class="bi bi-${user.status === 'active' ? 'x-circle' : 'check2-circle'}"></i>
              </button>
              ${user.id !== 1 ? 
                `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="删除"><i class="bi bi-trash"></i></button>` : 
                '<button class="btn btn-sm btn-secondary" disabled title="系统管理员"><i class="bi bi-lock"></i></button>'
              }
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('加载用户列表失败:', error);
      window.showError('加载用户列表失败：' + error.message);
    });
}

// 加载聊天室列表
function loadRooms() {
  fetch('/api/admin/rooms')
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(rooms => {
      const tbody = document.getElementById('roomsTableBody');
      tbody.innerHTML = '';
      
      rooms.forEach(room => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${room.id}</td>
          <td>${room.name}</td>
          <td>${room.creator?.nickname || '未知'}</td>
          <td>${room.memberCount}</td>
          <td>${formatDateTime(room.createdAt)}</td>
          <td>${room.retentionDays} 天</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-sm btn-info" onclick="viewRoomDetails(${room.id})" title="查看详情"><i class="bi bi-info-circle"></i></button>
              ${room.id !== 1 ? 
                `<button class="btn btn-sm btn-danger" onclick="deleteRoom(${room.id}, '${room.name.replace(/'/g, "\\'")}')" title="解散"><i class="bi bi-trash-fill"></i></button>` : 
                '<button class="btn btn-sm btn-secondary" disabled title="默认聊天室"><i class="bi bi-lock-fill"></i></button>'
              }
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('加载聊天室列表失败:', error);
      window.showError('加载聊天室列表失败：' + error.message);
    });
}

// 加载系统设置
function loadSettings() {
  // 这里应该从服务器获取系统设置
  // 现在用模拟数据
  document.getElementById('retentionDays').value = 180;
}

// 更新系统设置
async function updateSettings(e) {
  e.preventDefault();
  
  const retentionDays = parseInt(document.getElementById('retentionDays').value);
  
  if (retentionDays < 1 || retentionDays > 3650) {
    window.showError('保存期限必须在1-3650天之间');
    return;
  }
  
  try {
    // 这里应该发送请求到服务器更新设置
    console.log('更新系统设置:', { retentionDays });
    
    // 模拟成功响应
    window.showSuccess('系统设置更新成功！');
    
  } catch (error) {
    window.showError('更新设置失败：' + error.message);
  }
}

// 添加用户
async function addUser(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const userData = {
    username: formData.get('username'),
    nickname: formData.get('nickname'),
    password: formData.get('password'),
    isAdmin: formData.get('isAdmin') === 'on'
  };
  
  // 验证输入
  if (!userData.username || !userData.nickname || !userData.password) {
    window.showError('请填写所有必填字段');
    return;
  }
  
  if (userData.password.length < 6) {
    window.showError('密码至少需要6位字符');
    return;
  }
  
  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '添加失败');
    }
    
    const newUser = await response.json();
    window.showSuccess(`用户 ${newUser.username} 添加成功！`);
    
    // 关闭模态框
    bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
    
    // 刷新用户列表
    loadUsers();
    
  } catch (error) {
    window.showError('添加用户失败：' + error.message);
  }
}

// 编辑用户
async function editUser(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const userId = formData.get('userId');
  const userData = {
    nickname: formData.get('nickname'),
    newPassword: formData.get('newPassword') || undefined,
    isAdmin: formData.get('isAdmin') === 'on',
    status: formData.get('status')
  };
  
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '更新失败');
    }
    
    window.showSuccess('用户信息更新成功！');
    
    // 关闭模态框
    bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
    
    // 刷新用户列表
    loadUsers();
    
  } catch (error) {
    window.showError('更新用户失败：' + error.message);
  }
}

// 删除用户
async function deleteUser(userId) {
  if (!confirm('确定要删除这个用户吗？此操作无法撤销！')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '删除失败');
    }
    
    window.showSuccess('用户删除成功！');
    
    // 刷新用户列表
    loadUsers();
    
  } catch (error) {
    window.showError('删除用户失败：' + error.message);
  }
}

// 切换用户状态（封禁/解封）
async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'banned' : 'active';
  const action = newStatus === 'banned' ? '封禁' : '解封';
  
  if (!confirm(`确定要${action}这个用户吗？`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `${action}失败`);
    }
    
    window.showSuccess(`用户已${action}！`);
    
    // 刷新用户列表
    loadUsers();
    
  } catch (error) {
    window.showError(`${action}失败：` + error.message);
  }
}

// 删除聊天室
async function deleteRoom(roomId, roomName) {
  if (roomId === 1) {
    window.showError('默认大聊天室不能被解散');
    return;
  }
  
  if (!confirm(`确定要解散聊天室【${roomName}】吗？此操作无法撤销！`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '解散失败');
    }
    
    window.showSuccess('聊天室已解散！');
    
    // 刷新聊天室列表
    loadRooms();
    
  } catch (error) {
    window.showError('解散聊天室失败：' + error.message);
  }
}

// 查看聊天室详情
function viewRoomDetails(roomId) {
  fetch(`/api/admin/rooms/${roomId}`)
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(room => {
      const modal = document.getElementById('roomDetailsModal');
      
      // 填充模态框内容
      modal.querySelector('.room-name').textContent = room.name;
      modal.querySelector('.room-id').textContent = room.id;
      modal.querySelector('.room-creator').textContent = room.creator?.nickname || '未知';
      modal.querySelector('.member-count').textContent = room.memberCount;
      modal.querySelector('.message-count').textContent = room.messageCount;
      modal.querySelector('.created-at').textContent = formatDateTime(room.createdAt);
      modal.querySelector('.retention-days').textContent = `${room.retentionDays} 天`;
      modal.querySelector('.join-policy').textContent = room.joinPolicy === 'approval' ? '需审批' : '自由加入';
      
      // 显示成员列表
      const membersList = modal.querySelector('#roomMembersList');
      membersList.innerHTML = '';
      
      if (room.members && room.members.length > 0) {
        room.members.forEach(member => {
          const li = document.createElement('li');
          li.className = 'list-group-item d-flex justify-content-between align-items-center';
          li.innerHTML = `
            <div class="d-flex align-items-center">
              <img src="${member.avatarUrl}" alt="头像" class="avatar me-2">
              <div>
                <div>${member.nickname}</div>
                <small class="text-muted">${member.isModerator ? '管理员' : '成员'}</small>
              </div>
            </div>
            <span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-warning'}">
              ${member.status === 'active' ? '在线' : '离线'}
            </span>
          `;
          membersList.appendChild(li);
        });
      } else {
        membersList.innerHTML = '<li class="list-group-item text-center text-muted">暂无成员</li>';
      }
      
      // 显示模态框
      new bootstrap.Modal(modal).show();
    })
    .catch(error => {
      console.error('加载聊天室详情失败:', error);
      window.showError('加载详情失败：' + error.message);
    });
}

// 清理异常聊天室
async function cleanupRooms() {
  if (!confirm('确定要清理异常聊天室吗？这将删除没有成员或创建者的聊天室。')) {
    return;
  }
  
  try {
    // 这里应该发送请求到服务器清理异常聊天室
    console.log('清理异常聊天室');
    
    // 模拟成功响应
    window.showSuccess('异常聊天室清理完成！');
    
    // 刷新聊天室列表
    loadRooms();
    
  } catch (error) {
    window.showError('清理失败：' + error.message);
  }
}

// 退出登录
async function logout() {
  if (confirm('确定要退出登录吗？')) {
    try {
      // 调用后端退出登录接口
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('退出登录失败');
      }
      
      // 清除本地存储的认证信息
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      
      // 重定向到登录页
      window.location.href = '/login.html';
      
    } catch (error) {
      console.error('退出登录错误:', error);
      // 即使后端调用失败，也清除本地存储
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/login.html';
    }
  }
}

// 重置设置表单
function resetSettings() {
  loadSettings();
}

// 过滤用户
function filterUsers() {
  const searchValue = document.getElementById('searchUsers').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;
  
  const rows = document.querySelectorAll('#usersTableBody tr');
  
  rows.forEach(row => {
    const username = row.cells[1].textContent.toLowerCase();
    const nickname = row.cells[2].textContent.toLowerCase();
    const uid = row.cells[0].textContent;
    const status = row.cells[4].querySelector('.badge').classList.contains('status-active') ? 'active' : 'banned';
    
    const matchesSearch = searchValue === '' || 
                         username.includes(searchValue) || 
                         nickname.includes(searchValue) || 
                         uid.includes(searchValue);
    
    const matchesStatus = statusFilter === '' || status === statusFilter;
    
    row.style.display = matchesSearch && matchesStatus ? '' : 'none';
  });
}

// 过滤聊天室
function filterRooms() {
  const searchValue = document.getElementById('searchRooms').value.toLowerCase();
  const typeFilter = document.getElementById('filterRoomType').value;
  
  const rows = document.querySelectorAll('#roomsTableBody tr');
  
  rows.forEach(row => {
    const name = row.cells[1].textContent.toLowerCase();
    const rid = row.cells[0].textContent;
    const isPrivate = row.querySelector('.btn-danger[title="解散"]') === null; // 私聊没有解散按钮
    
    const matchesSearch = searchValue === '' || 
                         name.includes(searchValue) || 
                         rid.includes(searchValue);
    
    const matchesType = typeFilter === '' || 
                       (typeFilter === 'normal' && !isPrivate) || 
                       (typeFilter === 'private' && isPrivate);
    
    row.style.display = matchesSearch && matchesType ? '' : 'none';
  });
}

// 格式化日期时间
function formatDateTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  return date.toLocaleString();
}
