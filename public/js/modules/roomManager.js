// 房间管理模块

// 添加变量来跟踪历史消息加载状态
let loadingHistory = false;
let hasMoreHistory = true;

// 显示聊天室列表
export function displayRooms(rooms) {
    const roomList = document.getElementById('roomList');
    if (!roomList) {
        return;
    }
    
    if (!rooms || rooms.length === 0) {
        roomList.innerHTML = '<li class="list-group-item text-center text-muted">暂无聊天室</li>';
        return;
    }
    
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action';
        
        // 检查是否为当前选中的聊天室
        const currentRoomId = localStorage.getItem('currentRoomId');
        if (currentRoomId && currentRoomId == room.id) {
            li.classList.add('active');
        }
        
        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold">${room.name}</div>
                    ${room.note ? `<small class="text-muted">${room.note}</small>` : ''}
                </div>
                ${room.unreadCount > 0 ? 
                    `<span class="badge bg-primary rounded-pill">${room.unreadCount}</span>` : ''}
            </div>
        `;
        li.addEventListener('click', () => {
            // 添加进入聊天室的逻辑
            enterRoom(room);
            
            // 更新选中的聊天室样式
            document.querySelectorAll('#roomList .list-group-item').forEach(item => {
                item.classList.remove('active');
            });
            li.classList.add('active');
        });
        roomList.appendChild(li);
    });
}

// 进入聊天室
export function enterRoom(room) {
    // 检查房间对象和ID的有效性
    if (!room || !room.id || room.id === 'undefined') {
        window.showMessage('房间信息无效', 'danger');
        return;
    }
    
    // 清除已显示消息记录
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // 重置历史消息加载状态
    hasMoreHistory = true;
    loadingHistory = false;
    
    // 更新当前聊天室显示
    const currentRoomNameElement = document.getElementById('currentRoomName');
    if (currentRoomNameElement) {
        currentRoomNameElement.textContent = room.note || room.name;
    }
    
    // 保存当前聊天室信息到本地存储
    localStorage.setItem('currentRoomId', room.id);
    localStorage.setItem('currentRoomName', room.name);
    
    // 通过WebSocket加入聊天室
    if (window.socket && window.socket.connected) {
        window.socket.emit('joinRoom', room.id);
    }
    
    // 加载消息历史
    loadMessageHistory(room.id);
    
    // 绑定滚动事件以加载更多历史消息
    bindScrollEvent();
}

// 绑定滚动事件以加载更多历史消息
function bindScrollEvent() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 清除之前的事件监听器，避免重复绑定
    chatMessages.removeEventListener('scroll', handleScroll);
    
    // 添加新的滚动事件监听器
    chatMessages.addEventListener('scroll', handleScroll);
}

// 处理滚动事件
function handleScroll() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 当滚动到顶部附近且还有更多历史消息时加载历史消息
    if (chatMessages.scrollTop <= 50 && hasMoreHistory && !loadingHistory) {
        const currentRoomId = localStorage.getItem('currentRoomId');
        if (!currentRoomId) return;
        
        loadMoreHistory(currentRoomId);
    }
}

// 加载更多历史消息
async function loadMoreHistory(roomId) {
    if (loadingHistory || !hasMoreHistory) return;
    
    loadingHistory = true;
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        loadingHistory = false;
        return;
    }
    
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        loadingHistory = false;
        return;
    }
    
    // 保存当前滚动位置
    const scrollTop = chatMessages.scrollTop;
    const firstChild = chatMessages.firstElementChild;
    const initialHeight = chatMessages.scrollHeight;
    
    try {
        // 获取第一条消息的ID（最早的那条）
        const firstMessage = chatMessages.querySelector('.message-item:first-child');
        const beforeId = firstMessage ? firstMessage.dataset.messageId : null;
        
        // 构造请求URL
        let url = `/api/messages/history/${roomId}?limit=20`;
        if (beforeId) {
            url += `&beforeId=${beforeId}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('加载历史消息失败');
        }
        
        const messages = await response.json();
        
        if (messages && messages.length > 0) {
            // 使用 DocumentFragment 提高性能
            const fragment = document.createDocumentFragment();
            
            // 反向遍历消息数组，确保消息顺序正确
            for (let i = messages.length - 1; i >= 0; i--) {
                const message = messages[i];
                const messageElement = document.createElement('div');
                messageElement.className = 'message-item mb-3';
                messageElement.setAttribute('data-message-id', message.messageId);
                messageElement.innerHTML = await window.renderMessage(message);
                fragment.insertBefore(messageElement, fragment.firstChild);
            }
            
            // 插入到现有消息之前
            chatMessages.insertBefore(fragment, chatMessages.firstChild);
            
            // 调整滚动位置以保持用户视角不变
            const finalHeight = chatMessages.scrollHeight;
            chatMessages.scrollTop = scrollTop + (finalHeight - initialHeight);
        } else {
            // 没有更多消息了
            hasMoreHistory = false;
        }
    } catch (error) {
        console.error('加载历史消息失败:', error);
        window.showMessage('加载历史消息失败: ' + error.message, 'danger');
    } finally {
        loadingHistory = false;
    }
}

// 加载消息历史
export function loadMessageHistory(roomId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    // 确保roomId是数字类型
    const roomIdInt = parseInt(roomId);
    if (isNaN(roomIdInt)) {
        window.showMessage('无效的聊天室ID', 'danger');
        return;
    }
    
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        return;
    }
    
    // 重置历史消息状态
    hasMoreHistory = true;
    loadingHistory = false;
    
    // 显示加载中提示
    chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>加载消息中...</p></div>';
    
    fetch(`/api/messages/history/${roomIdInt}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '加载消息历史失败');
            });
        }
        return response.json();
    })
    .then(async messages => {
        await window.displayMessages(messages);
    })
    .catch(error => {
        chatMessages.innerHTML = `<div class="text-center text-muted my-3"><p>加载消息失败: ${error.message}</p></div>`;
        window.showMessage('加载消息历史失败: ' + error.message, 'danger');
    });
}

// 加载聊天室列表
export function loadRooms() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('未登录，无法加载聊天室列表');
        return;
    }
    
    fetch('/api/rooms', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('加载聊天室列表失败');
        }
        return response.json();
    })
    .then(rooms => {
        displayRooms(rooms);
    })
    .catch(error => {
        console.error('加载聊天室列表错误:', error);
        window.showMessage('加载聊天室列表失败: ' + error.message, 'danger');
    });
}

// 加载待处理请求
export async function loadPendingRequests(roomId, token) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/pending-requests`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const requests = await response.json();
        displayPendingRequests(requests);
    } catch (error) {
        console.error('加载待处理请求失败:', error);
        window.showMessage('加载待处理请求失败: ' + error.message, 'danger');
    }
}

// 显示待处理请求
export function displayPendingRequests(requests) {
    const container = document.getElementById('pendingRequestsContainer');
    const noRequestsMessage = document.getElementById('noRequestsMessage');
    const joinRequestsSection = document.getElementById('joinRequestsSection');
    
    if (!container) return;

    // 确保审批区域可见（无论是否有请求）
    if (joinRequestsSection) {
        joinRequestsSection.style.display = 'block';
    }

    // 如果没有请求，显示"暂无请求"消息
    if (!requests || requests.length === 0) {
        if (noRequestsMessage) {
            noRequestsMessage.style.display = 'block';
        }
        container.innerHTML = '';
        return;
    }

    // 隐藏"暂无请求"消息
    if (noRequestsMessage) {
        noRequestsMessage.style.display = 'none';
    }

    let html = '';
    requests.forEach(request => {
        html += `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <img src="${request.user.avatarUrl || '/default-avatar.png'}" 
                                 alt="头像" 
                                 class="rounded-circle me-3" 
                                 width="40" 
                                 height="40"
                                 onerror="this.src='/default-avatar.png'">
                            <div>
                                <h6 class="mb-1">${request.user.nickname || request.user.username || '未知用户'}</h6>
                                <small class="text-muted">申请时间: ${new Date(request.requestTime).toLocaleString()}</small>
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-success approve-request-btn me-1" 
                                    data-room-id="${request.roomId}"
                                    data-user-id="${request.userId}">
                                <i class="bi bi-check"></i> 允许
                            </button>
                            <button class="btn btn-sm btn-danger reject-request-btn" 
                                    data-room-id="${request.roomId}"
                                    data-user-id="${request.userId}">
                                <i class="bi bi-x"></i> 拒绝
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // 为批准和拒绝按钮添加事件监听器
    document.querySelectorAll('.approve-request-btn').forEach(button => {
        button.addEventListener('click', function() {
            const roomId = this.getAttribute('data-room-id');
            const userId = this.getAttribute('data-user-id');
            handleJoinRequest(roomId, userId, 'approve');
        });
    });
    
    document.querySelectorAll('.reject-request-btn').forEach(button => {
        button.addEventListener('click', function() {
            const roomId = this.getAttribute('data-room-id');
            const userId = this.getAttribute('data-user-id');
            handleJoinRequest(roomId, userId, 'reject');
        });
    });
}

// 处理加入请求（批准或拒绝）
export async function handleJoinRequest(roomId, userId, action) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${roomId}/approve-join-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: parseInt(userId),
                action: action
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // 显示成功消息
        window.showMessage(action === 'approve' ? '已允许用户加入' : '已拒绝用户加入请求', 'success');

        // 重新加载待处理请求
        await loadPendingRequests(roomId, token);
    } catch (error) {
        console.error('处理加入请求失败:', error);
        window.showMessage('处理失败: ' + error.message, 'danger');
    }
}

// 绑定各种按钮事件
export function bindRoomButtons() {
    // 创建聊天室按钮
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', function() {
            const createRoomModalEl = document.getElementById('createRoomModal');
            if (createRoomModalEl) {
                const createRoomModal = new bootstrap.Modal(createRoomModalEl);
                if (createRoomModal) {
                    createRoomModal.show();
                }
            }
        });
    }
    
    // 刷新聊天室列表按钮
    const refreshRoomListBtn = document.getElementById('refreshRoomListBtn');
    if (refreshRoomListBtn) {
        refreshRoomListBtn.addEventListener('click', function() {
            // 添加旋转动画类
            const icon = refreshRoomListBtn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
            }
            
            // 刷新聊天室列表
            loadRooms();
            
            // 延迟移除动画类，给用户视觉反馈
            setTimeout(() => {
                if (icon) {
                    icon.classList.remove('fa-spin');
                }
            }, 1000);
        });
    }
    
    // 搜索聊天室按钮
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) {
        searchRoomBtn.addEventListener('click', function() {
            const searchRoomModalEl = document.getElementById('searchRoomModal');
            if (searchRoomModalEl) {
                const searchRoomModal = new bootstrap.Modal(searchRoomModalEl);
                if (searchRoomModal) {
                    searchRoomModal.show();
                    
                    // 清空之前的搜索结果
                    const searchResultsContainer = document.getElementById('searchResultsContainer');
                    if (searchResultsContainer) {
                        searchResultsContainer.innerHTML = '';
                    }
                    
                    // 清空搜索框
                    const searchKeywordInput = document.getElementById('searchKeywordInput');
                    if (searchKeywordInput) {
                        searchKeywordInput.value = '';
                    }
                }
            }
        });
    }
    
    // 实际执行搜索的按钮
    const performSearchButton = document.getElementById('performSearchButton');
    if (performSearchButton) {
        performSearchButton.addEventListener('click', function() {
            const searchKeywordInput = document.getElementById('searchKeywordInput');
            if (searchKeywordInput) {
                const keyword = searchKeywordInput.value.trim();
                if (keyword) {
                    searchRoomsAndUsers(keyword);
                } else {
                    window.showMessage('请输入搜索关键词', 'warning');
                }
            }
        });
    }
    
    // 成员列表按钮
    const membersBtn = document.getElementById('membersBtn');
    if (membersBtn) {
        membersBtn.addEventListener('click', function() {
            loadRoomMembers();
            
            const membersModalEl = document.getElementById('membersModal');
            if (membersModalEl) {
                const membersModal = new bootstrap.Modal(membersModalEl);
                if (membersModal) {
                    membersModal.show();
                }
            }
        });
    }
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            const settingsModalEl = document.getElementById('settingsModal');
            if (settingsModalEl) {
                const settingsModal = new bootstrap.Modal(settingsModalEl);
                if (settingsModal) {
                    settingsModal.show();
                }
            }
        });
    }
    
    // 绑定创建聊天室表单提交事件
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(createRoomForm);
            const roomData = {
                name: formData.get('name'),
                note: formData.get('note') || '',
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on',
                allowAudio: formData.get('allowAudio') === 'on'
            };
            
            createRoom(roomData);
        });
    }
}

// 搜索聊天室和用户功能
function searchRoomsAndUsers(keyword) {
    if (!keyword || !keyword.trim()) {
        window.showMessage('请输入搜索关键词', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    if (!searchResultsContainer) return;
    
    // 显示加载状态
    searchResultsContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">加载中...</span></div></div>';
    
    // 搜索聊天室和用户
    fetch(`/api/search?q=${encodeURIComponent(keyword)}`)
    .then(response => {
        if (!response.ok) {
            throw new Error('搜索失败');
        }
        return response.json();
    })
    .then(data => {
        // 根据实际API格式处理数据
        if (data.results && Array.isArray(data.results)) {
            // 将统一的结果列表分离为房间和用户
            const rooms = data.results.filter(item => item.type === 'room');
            const users = data.results.filter(item => item.type === 'user');
            displaySearchResults(rooms, users);
        } else {
            // 兼容旧格式
            const rooms = data.rooms || [];
            const users = data.users || [];
            displaySearchResults(rooms, users);
        }
    })
    .catch(error => {
        console.error('搜索失败:', error);
        searchResultsContainer.innerHTML = '<div class="alert alert-danger">搜索失败，请稍后再试</div>';
    });
}

// 显示搜索结果
function displaySearchResults(rooms, users) {
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    if (!searchResultsContainer) return;
    
    // 如果没有结果
    if ((!rooms || rooms.length === 0) && (!users || users.length === 0)) {
        searchResultsContainer.innerHTML = '<div class="alert alert-info">未找到相关结果</div>';
        return;
    }
    
    let resultsHTML = '';
    
    // 添加聊天室结果
    if (rooms && rooms.length > 0) {
        resultsHTML += `
            <div class="mb-4">
                <h6>聊天室</h6>
                <div class="list-group">
        `;
        
        rooms.forEach(room => {
            resultsHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${room.name}</h6>
                        <small class="text-muted">ID: ${room.id} | 创建者: ${room.creatorNickname} | 成员: ${room.memberCount}人</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary join-room-btn" data-room-id="${room.id}">
                        加入
                    </button>
                </div>
            `;
        });
        
        resultsHTML += `
                </div>
            </div>
        `;
    }
    
    // 添加用户结果
    if (users && users.length > 0) {
        resultsHTML += `
            <div>
                <h6>用户</h6>
                <div class="list-group">
        `;
        
        users.forEach(user => {
            resultsHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="${user.avatarUrl || '/default-avatar.png'}" 
                             alt="头像" 
                             class="rounded-circle me-2" 
                             width="32" 
                             height="32"
                             onerror="this.src='/default-avatar.png'">
                        <div>
                            <h6 class="mb-0">${user.nickname || user.username}</h6>
                            <small class="text-muted">用户名: ${user.username} | UID: ${user.id}</small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary start-private-chat-btn" data-user-id="${typeof user.id === 'object' ? user.id.id : user.id}">
                        私聊
                    </button>
                </div>
            `;
        });
        
        resultsHTML += `
                </div>
            </div>
        `;
    }
    
    searchResultsContainer.innerHTML = resultsHTML;
    
    // 为加入房间按钮添加事件监听器
    document.querySelectorAll('.join-room-btn').forEach(button => {
        button.addEventListener('click', function() {
            const roomId = this.getAttribute('data-room-id');
            // 调用申请加入房间函数而不是直接加入
            requestToJoinRoom(roomId);
            
            // 关闭搜索模态框
            const searchModal = bootstrap.Modal.getInstance(document.getElementById('searchRoomModal'));
            if (searchModal) {
                searchModal.hide();
            }
        });
    });
    
    // 为私聊按钮添加事件监听器
    document.querySelectorAll('.start-private-chat-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            startPrivateChat(userId);
            
            // 关闭搜索模态框
            const searchModal = bootstrap.Modal.getInstance(document.getElementById('searchRoomModal'));
            if (searchModal) {
                searchModal.hide();
            }
        });
    });
}

// 开始私聊
export function startPrivateChat(userId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }

    // 如果userId是对象，提取id属性
    if (typeof userId === 'object' && userId !== null) {
        userId = userId.id;
    }

    fetch('/api/rooms/private', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // 注意：根据规范，这里应该使用cookie传输，但前端代码中仍使用Authorization header
        },
        body: JSON.stringify({ targetUserId: parseInt(userId) })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || '创建私聊失败');
            });
        }
        return response.json();
    })
    .then(data => {
        const room = data.room || data;
        const roomId = room.roomId || room.id;
        
        if (roomId) {
            // 加入房间 - 使用从websocket.js导入的joinRoom函数
            import('./websocket.js').then(module => {
                module.joinRoom(roomId);
            });
            
            // 通过WebSocket通知对方用户刷新聊天室列表
            if (window.socket && window.socket.connected) {
                window.socket.emit('refreshRoomList', { targetUserId: parseInt(userId) });
            }
            
            // 关闭搜索模态框
            const searchModal = bootstrap.Modal.getInstance(document.getElementById('searchRoomModal'));
            if (searchModal) {
                searchModal.hide();
            }
            
            window.showMessage(`已创建私聊`, 'success');
        } else {
            throw new Error('无法获取房间ID');
        }
    })
    .catch(error => {
        console.error('创建私聊失败:', error);
        window.showMessage('创建私聊失败: ' + error.message, 'danger');
    });
}

// 加载聊天室成员列表
function loadRoomMembers() {
    const currentRoomId = localStorage.getItem('currentRoomId');
    if (!currentRoomId) {
        window.showMessage('请先选择一个聊天室', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/${currentRoomId}/members`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('获取成员列表失败');
        }
        return response.json();
    })
    .then(members => {
        displayRoomMembers(members);
    })
    .catch(error => {
        console.error('加载成员列表失败:', error);
        window.showMessage('加载成员列表失败: ' + error.message, 'danger');
    });
}

// 显示聊天室成员列表
function displayRoomMembers(members) {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    if (!members || members.length === 0) {
        membersList.innerHTML = '<li class="list-group-item text-center text-muted">暂无成员</li>';
        return;
    }
    
    membersList.innerHTML = '';
    members.forEach(member => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${member.avatarUrl || '/default-avatar.png'}" 
                     alt="头像" 
                     class="rounded-circle me-2" 
                     width="32" 
                     height="32"
                     onerror="this.src='/default-avatar.png'">
                <div>
                    <div>${member.nickname || member.username}</div>
                    ${member.role ? `<small class="text-muted">${getRoleDisplayName(member.role)}</small>` : ''}
                </div>
            </div>
            ${member.role !== 'creator' ? `
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                            type="button" 
                            data-bs-toggle="dropdown">
                        管理
                    </button>
                    <ul class="dropdown-menu">
                        ${member.role !== 'admin' ? `<li><a class="dropdown-item" href="#" onclick="setMemberRole('${member.id}', 'admin')">设为管理员</a></li>` : ''}
                        ${member.role === 'admin' ? `<li><a class="dropdown-item" href="#" onclick="setMemberRole('${member.id}', 'member')">取消管理员</a></li>` : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="kickMember('${member.id}')">踢出聊天室</a></li>
                    </ul>
                </div>
            ` : ''}
        `;
        membersList.appendChild(li);
    });
}

// 获取角色显示名称
function getRoleDisplayName(role) {
    switch (role) {
        case 'creator': return '创建者';
        case 'admin': return '管理员';
        case 'member': return '成员';
        default: return role;
    }
}

// 设置成员角色
window.setMemberRole = function(userId, role) {
    const currentRoomId = localStorage.getItem('currentRoomId');
    if (!currentRoomId) {
        window.showMessage('请先选择一个聊天室', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    // 修复角色值映射，前端传递的admin需要转换为后端期望的'member'或'admin'值
    const mappedRole = role === 'admin' ? 'admin' : 
                      role === 'member' ? 'member' : 
                      'member'; // 默认设为普通成员
    
    fetch(`/api/rooms/${currentRoomId}/members/${userId}/role`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: mappedRole })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '操作失败');
            });
        }
        return response.json();
    })
    .then(result => {
        window.showMessage('操作成功', 'success');
        loadRoomMembers(); // 重新加载成员列表
    })
    .catch(error => {
        console.error('设置成员角色失败:', error);
        window.showMessage('设置成员角色失败: ' + error.message, 'danger');
    });
};

// 踢出成员
window.kickMember = function(userId) {
    const currentRoomId = localStorage.getItem('currentRoomId');
    if (!currentRoomId) {
        window.showMessage('请先选择一个聊天室', 'warning');
        return;
    }
    
    // 添加参数验证
    if (!userId || userId === 'undefined' || userId === 'null') {
        window.showMessage('无效的用户ID', 'danger');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/${currentRoomId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '操作失败');
            });
        }
        return response.json();
    })
    .then(result => {
        window.showMessage('操作成功', 'success');
        loadRoomMembers(); // 重新加载成员列表
    })
    .catch(error => {
        console.error('踢出成员失败:', error);
        window.showMessage('踢出成员失败: ' + error.message, 'danger');
    });
};

// 添加申请加入房间的函数
async function requestToJoinRoom(roomId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${roomId}/join-request`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            // 检查响应内容判断是否需要审核
            if (data.requiresApproval) {
                // 需要审核
                window.showMessage('加入请求已发送，等待房主审批', 'success');
            } else {
                // 不需要审核，直接加入成功
                window.showMessage('成功加入聊天室', 'success');
                // 刷新聊天室列表以显示新加入的房间
                loadRooms();
            }
        } else {
            window.showMessage(data.error || '发送加入请求失败', 'danger');
        }
    } catch (error) {
        console.error('申请加入房间失败:', error);
        window.showMessage('申请加入房间失败: ' + error.message, 'danger');
    }
}

// 将requestToJoinRoom函数暴露到全局作用域
window.requestToJoinRoom = requestToJoinRoom;

// 创建聊天室
export async function createRoom(roomData) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }

    try {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(roomData)
        });

        const data = await response.json();
        
        if (response.ok) {
            window.showMessage('聊天室创建成功', 'success');
            
            // 重新加载聊天室列表
            await loadRooms();
            
            // 关闭创建聊天室模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('createRoomModal'));
            if (modal) modal.hide();
        } else {
            window.showMessage(data.error || '聊天室创建失败', 'danger');
        }
    } catch (error) {
        console.error('创建聊天室错误:', error);
        window.showMessage('网络错误，请稍后再试', 'danger');
    }
}