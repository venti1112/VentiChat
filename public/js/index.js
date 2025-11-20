// 主页脚本 - 仅在index.html中使用

// 检查登录状态
// 删除错误的递归定义，直接使用common.js中的全局函数

// 全局变量
let currentRoomId = null;
let currentUserData = null;
let currentUserId = null;
let rooms = [];
let messages = [];
let hasMoreMessages = true;
let loadingMessages = false;
let unreadCounts = {};
const socket = io();

// DOM元素引用
const roomList = document.getElementById('roomList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const currentRoomName = document.getElementById('currentRoomName');
const chatMessages = document.getElementById('chatMessages');

// 状态变量
let hasMoreHistory = true;
let loadingHistory = false;

// 加载状态管理
function setLoadingHistory(loading) {
  loadingHistory = loading;
  // TODO: 可以在这里添加加载指示器的显示/隐藏逻辑
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  window.verifyToken()
  initChat();
  loadRooms();
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  // 发送消息
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // 创建聊天室表单提交
  document.getElementById('createRoomForm').addEventListener('submit', createRoom);
  
  // 搜索用户
  document.getElementById('searchUserBtn').addEventListener('click', searchUser);
  
  // 文件上传
  document.getElementById('sendImageBtn').addEventListener('click', () => triggerFileUpload('image'));
  document.getElementById('sendVideoBtn').addEventListener('click', () => triggerFileUpload('video'));
  document.getElementById('sendFileBtn').addEventListener('click', () => triggerFileUpload('file'));
  
  // 成员列表按钮
  document.getElementById('membersBtn').addEventListener('click', showMembers);
  
  // 退出登录按钮
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

// 加载聊天室列表
function loadRooms() {
  fetch('/api/rooms')
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(rooms => {
      roomList.innerHTML = '';
      rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.dataset.roomId = room.id;
        li.innerHTML = `
          <div class="room-item">
            <strong>${room.note || room.name}</strong>
            ${room.note ? `<small class="text-muted">(${room.name})</small>` : ''}
          </div>
          <span class="badge bg-primary rounded-pill">${room.unreadCount || 0}</span>
        `;
        li.addEventListener('click', () => joinRoom(room));
        roomList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('加载聊天室失败:', error);
      roomList.innerHTML = '<li class="list-group-item text-danger">加载失败，请重试</li>';
    });
}

// 加入聊天室
function joinRoom(room) {
  currentRoomId = room.id;
  currentRoomName.textContent = room.note || room.name;
  
  // 清空消息区域
  chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>加载中...</p></div>';
  
  // 加入Socket.IO房间
  socket.emit('joinRoom', currentRoomId);
  
  // 加载历史消息
  loadHistoryMessages();
}

// 监听滚动事件，加载历史消息
chatMessages.addEventListener('scroll', () => {
  if (chatMessages.scrollTop < 50 && hasMoreHistory) {
    loadHistoryMessages(true);
  }
});

// 加载历史消息
function loadHistoryMessages(append = false) {
  if (loadingHistory || !currentRoomId || !hasMoreHistory) return;
  
  setLoadingHistory(true);
  
  const lastMessageId = append ? 
    document.querySelector('.message')?.dataset.messageId : 
    null;
  
  fetch(`/api/messages?roomId=${currentRoomId}${lastMessageId ? `&beforeId=${lastMessageId}` : ''}`)
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(messages => {
      if (messages.length === 0) {
        hasMoreHistory = false;
        return;
      }
      
      messages.forEach(message => {
        if (append) {
          addMessageToChat(message, 'prepend');
        } else {
          addMessageToChat(message);
        }
      });
      
      // 如果加载的消息少于20条，说明没有更多历史消息
      if (messages.length < 20) {
        hasMoreHistory = false;
      }
    })
    .catch(error => {
      console.error('加载历史消息失败:', error);
      window.showError('加载历史消息失败：' + error.message);
    })
    .finally(() => {
      setLoadingHistory(false);
    });
}

// 添加消息到聊天界面
function addMessageToChat(message, position = 'append') {
  if (message.isDeleted) return;

  const isCurrentUser = message.senderId === currentUser.id;
  const now = new Date();
  const messageTime = new Date(message.sentAt || message.createdAt);
  const minutesDiff = Math.floor((now - messageTime) / 60000);
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${isCurrentUser ? 'message-right current-user' : 'message-left'}`;
  messageElement.dataset.messageId = message.id;
  
  messageElement.innerHTML = `
    <img src="${message.avatarUrl || 'https://via.placeholder.com/40'}" alt="头像" class="avatar me-2">
    <div class="message-content">
      <div class="small text-muted">${message.nickname}</div>
      <div class="message-bubble ${message.type !== 'text' ? 'message-' + message.type : 'message-text'}">
        ${message.type === 'text' ? message.content :
          message.type === 'image' ? `<img src="${message.fileUrl}" alt="图片" class="message-image">` :
          message.type === 'video' ? `<video controls class="message-video"><source src="${message.fileUrl}" type="video/mp4"></video>` :
          `<div class="message-file">
              <i class="bi bi-file-earmark"></i> ${message.content}
              <a href="${message.fileUrl}" class="d-block mt-1" target="_blank">点击下载</a>
           </div>`}
      </div>
      <div class="message-time">${formatTime(message.sentAt || message.createdAt)}</div>
    </div>
  `;
  
  // 添加撤回按钮（仅对自己在10分钟内发送的消息显示）
  if (isCurrentUser && !message.isDeleted && minutesDiff < 10) {
    const retractBtn = document.createElement('button');
    retractBtn.className = 'btn btn-sm btn-link p-0 ms-2 text-danger retract-btn';
    retractBtn.title = '撤回';
    retractBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
    retractBtn.addEventListener('click', () => retractMessage(message.id));
    
    // 将撤回按钮添加到消息时间后面
    const timeElement = messageElement.querySelector('.message-time');
    if (timeElement) {
      timeElement.appendChild(retractBtn);
    }
  }
  
  if (position === 'prepend') {
    chatMessages.insertBefore(messageElement, chatMessages.firstChild);
  } else {
    chatMessages.appendChild(messageElement);
  }
  
  // 自动滚动到底部
  if (position !== 'prepend') {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// 发送消息
function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !currentRoomId) return;
  
  // 立即显示本地消息
  const localMessage = {
    id: Date.now(),
    senderId: currentUser.id,
    nickname: currentUser.nickname,
    avatarUrl: currentUser.avatarUrl,
    content: content,
    type: 'text',
    sentAt: new Date().toISOString(),
    isDeleted: false
  };
  addMessageToChat(localMessage);
  
  // 清空输入框
  messageInput.value = '';
  
  // 发送到服务器
  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      content: content,
      type: 'text'
    })
  })
  .catch(error => {
    console.error('发送消息失败:', error);
    window.showError('发送失败，请检查网络连接');
  });
}

// 撤回消息
function retractMessage(messageId) {
  if (!confirm('确定要撤回这条消息吗？')) return;
  
  fetch(`/api/messages/${messageId}/retract`, {
    method: 'PUT'
  })
  .then(response => {
    if (!response.ok) throw new Error('撤回失败');
    return response.json();
  })
  .then(updatedMessage => {
    // 更新UI
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const bubble = messageElement.querySelector('.bubble');
      bubble.innerHTML = '<em class="text-muted">[已撤回]</em>';
      messageElement.querySelector('.retract-btn')?.remove();
    }
    window.showSuccess('消息已撤回');
  })
  .catch(error => {
    window.showError('撤回失败：' + error.message);
  });
}

// 触发文件上传
function triggerFileUpload(type) {
  const input = document.createElement('input');
  input.type = 'file';
  
  if (type === 'image') {
    input.accept = 'image/*';
  } else if (type === 'video') {
    input.accept = 'video/*';
  }
  // file类型接受所有文件
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', currentRoomId);
    formData.append('type', type);
    
    try {
      const response = await fetch('/api/messages/file', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '上传失败');
      }
      
      const message = await response.json();
      addMessageToChat(message);
      
    } catch (error) {
      window.showError('文件上传失败：' + error.message);
    }
  };
  
  input.click();
}

// 创建聊天室
async function createRoom(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const roomData = {
    name: formData.get('name'),
    requireApproval: formData.get('requireApproval') === 'on',
    allowImages: formData.get('allowImages') === 'on',
    allowVideos: formData.get('allowVideos') === 'on',
    allowFiles: formData.get('allowFiles') === 'on'
  };
  
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '创建失败');
    }
    
    const newRoom = await response.json();
    window.showSuccess(`聊天室 ${newRoom.name} 创建成功！`);
    
    // 关闭模态框
    bootstrap.Modal.getInstance(document.getElementById('createRoomModal')).hide();
    
    // 刷新聊天室列表
    loadRooms();
    
  } catch (error) {
    window.showError('创建聊天室失败：' + error.message);
  }
}

// 搜索用户
function searchUser() {
  const query = document.getElementById('searchUserInput').value.trim();
  if (!query) return;
  
  fetch(`/api/users/search?query=${encodeURIComponent(query)}`)
    .then(response => {
      if (!response.ok) throw new Error('搜索失败');
      return response.json();
    })
    .then(users => {
      const resultsList = document.getElementById('searchResults');
      resultsList.innerHTML = '';
      
      if (users.length === 0) {
        resultsList.innerHTML = '<li class="list-group-item text-center text-muted">未找到用户</li>';
        return;
      }
      
      users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
          <div>
            <strong>${user.nickname}</strong>
            <small class="text-muted ms-2">@${user.username}</small>
          </div>
          <button class="btn btn-sm btn-primary start-private-chat" data-user-id="${user.id}" data-nickname="${user.nickname}">私聊</button>
        `;
        li.querySelector('.start-private-chat').addEventListener('click', () => startPrivateChat(user));
        resultsList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('搜索用户失败:', error);
      window.showError('搜索失败，请重试');
    });
}

// 开始私聊
function startPrivateChat(user) {
  fetch('/api/rooms/private', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: user.id })
  })
  .then(response => {
    if (!response.ok) throw new Error('创建私聊失败');
    return response.json();
  })
  .then(room => {
    joinRoom(room);
    
    // 关闭模态框
    bootstrap.Modal.getInstance(document.getElementById('searchUserModal')).hide();
  })
  .catch(error => {
    window.showError('无法创建私聊：' + error.message);
  });
}

// 显示成员列表
function showMembers() {
  if (!currentRoomId) return;
  
  fetch(`/api/rooms/${currentRoomId}/members`)
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(members => {
      const membersList = document.getElementById('membersList');
      membersList.innerHTML = '';
      
      members.forEach(member => {
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
          ${member.id !== currentUser.id ? 
            `<div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" title="私聊"><i class="bi bi-chat-left-dots"></i></button>
                ${currentRoomId !== 1 ? 
                  `<button class="btn btn-sm btn-outline-danger kick-btn" data-user-id="${member.id}" title="踢出"><i class="bi bi-person-dash"></i></button>` : ''
                }
            </div>` : ''}
        `;
        
        if (li.querySelector('.kick-btn')) {
          li.querySelector('.kick-btn').addEventListener('click', (e) => {
            const userId = e.target.closest('.kick-btn').dataset.userId;
            kickUser(userId);
          });
        }
        
        membersList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('加载成员列表失败:', error);
      window.showError('加载成员失败，请重试');
    });
  
  // 显示模态框
  new bootstrap.Modal(document.getElementById('membersModal')).show();
}

// 踢出用户
function kickUser(userId) {
  if (!currentRoomId || currentRoomId === 1) return;
  
  if (!confirm('确定要将该用户踢出聊天室吗？')) return;
  
  fetch(`/api/rooms/${currentRoomId}/members/${userId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) throw new Error('踢出失败');
    window.showSuccess('用户已踢出');
    // 刷新成员列表
    if (document.getElementById('membersModal').classList.contains('show')) {
      showMembers();
    }
  })
  .catch(error => {
    window.showError('踢出用户失败：' + error.message);
  });
}

// 标记为已读
function markAsRead() {
  if (!currentRoomId) return;
  
  const messages = Array.from(chatMessages.querySelectorAll('.message'));
  if (messages.length === 0) return;
  
  // 获取最后一条消息的ID
  const lastMessageId = messages[messages.length - 1]
    .dataset.messageId || Date.now();
  
  fetch('/api/rooms/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: currentRoomId, messageId: lastMessageId })
  }).catch(console.error);
}

// 格式化时间显示
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000 && date.getDate() === now.getDate()) return `${Math.floor(diff / 3600000)}小时前`;
  
  return date.toLocaleString();
}


// 监听Socket.IO事件
socket.on('receiveMessage', (message) => {
  if (message.roomId === currentRoomId) {
    addMessageToChat(message);
    
    // 自动标记为已读
    markAsRead();
  } else {
    // 更新未读数
    const roomItem = document.querySelector(`[data-room-id="${message.roomId}"]`);
    if (roomItem) {
      const badge = roomItem.querySelector('.badge');
      if (badge) {
        const currentUnread = parseInt(badge.textContent) || 0;
        badge.textContent = currentUnread + 1;
        badge.style.display = 'inline';
      }
    }
  }
});

// 监听消息撤回事件
socket.on('messageRetracted', (data) => {
  const { messageId, roomId, retractedBy } = data;
  
  // 更新当前聊天室中的消息
  if (roomId === currentRoomId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      // 找到消息气泡并更新内容
      const bubble = messageElement.querySelector('.message-bubble');
      if (bubble) {
        bubble.innerHTML = '<em class="text-muted">[已撤回]</em>';
        bubble.style.fontStyle = 'italic';
      }
      
      // 移除撤回按钮
      const retractBtn = messageElement.querySelector('.retract-btn');
      if (retractBtn) {
        retractBtn.remove();
      }
    }
  }
});













