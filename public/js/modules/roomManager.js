// 房间管理模块

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

// 绑定聊天室相关按钮事件
export function bindRoomButtons() {
    // 创建聊天室按钮
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', function() {
            const createRoomModal = new bootstrap.Modal(document.getElementById('createRoomModal'));
            if (createRoomModal) {
                createRoomModal.show();
            }
        });
    }
    
    // 搜索聊天室按钮
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) {
        searchRoomBtn.addEventListener('click', function() {
            const searchRoomModal = new bootstrap.Modal(document.getElementById('searchRoomModal'));
            if (searchRoomModal) {
                searchRoomModal.show();
            }
        });
    }
    
    // 搜索聊天室按钮事件
    const searchRoomButton = document.getElementById('searchRoomButton');
    if (searchRoomButton) {
        searchRoomButton.addEventListener('click', function() {
            const searchInput = document.getElementById('searchRoomInput');
            if (searchInput) {
                searchRooms(searchInput.value);
            }
        });
    }
    
    // 成员按钮
    const membersBtn = document.getElementById('membersBtn');
    if (membersBtn) {
        membersBtn.addEventListener('click', function() {
            // 获取当前聊天室的成员列表
            loadRoomMembers();
            
            const membersModal = new bootstrap.Modal(document.getElementById('membersModal'));
            if (membersModal) {
                membersModal.show();
            }
        });
    }
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
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

            fetch(`/api/rooms/${currentRoomId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('获取聊天室信息失败');
                }
                return response.json();
            })
            .then(room => {
                // 塞入表单数据
                document.getElementById('roomNameSetting').value = room.name;
                document.getElementById('requireApprovalSetting').checked = room.requireApproval;
                document.getElementById('allowImagesSetting').checked = room.allowImages;
                document.getElementById('allowVideosSetting').checked = room.allowVideos;
                document.getElementById('allowFilesSetting').checked = room.allowFiles;
                
                // 显示模态框
                const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
                if (settingsModal) {
                    settingsModal.show();
                }
            })
            .catch(error => {
                console.error('获取聊天室信息失败:', error);
                window.showMessage('获取聊天室信息失败: ' + error.message, 'danger');
            });
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
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on'
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
                window.showMessage('未登录，请先登录', 'danger');
                return;
            }
            
            fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(roomData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '创建聊天室失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                window.showMessage('聊天室创建成功', 'success');
                // 隐藏模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('createRoomModal'));
                if (modal) {
                    modal.hide();
                }
                // 重新加载聊天室列表
                if (typeof window.loadRooms === 'function') {
                    window.loadRooms();
                }
            })
            .catch(error => {
                console.error('创建聊天室失败:', error);
                window.showMessage(error.message || '创建聊天室失败', 'danger');
            });
        });
    }
    
    // 绑定聊天室设置表单提交事件
    const roomSettingsForm = document.getElementById('roomSettingsForm');
    if (roomSettingsForm) {
        roomSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (!currentRoomId) {
                window.showMessage('请先选择一个聊天室', 'warning');
                return;
            }
            
            const formData = new FormData(roomSettingsForm);
            const roomData = {
                name: formData.get('name'),
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on'
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
                window.showMessage('未登录，请先登录', 'danger');
                return;
            }
            
            fetch(`/api/rooms/${currentRoomId}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(roomData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '更新聊天室设置失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                window.showMessage('聊天室设置已更新', 'success');
                // 隐藏模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                if (modal) {
                    modal.hide();
                }
                // 更新当前聊天室名称显示
                const currentRoomNameElement = document.getElementById('currentRoomName');
                if (currentRoomNameElement) {
                    currentRoomNameElement.textContent = room.name;
                }
                // 重新加载聊天室列表
                if (typeof window.loadRooms === 'function') {
                    window.loadRooms();
                }
            })
            .catch(error => {
                console.error('更新聊天室设置失败:', error);
                window.showMessage(error.message || '更新聊天室设置失败', 'danger');
            });
        });
    }
}

// 加载聊天室成员列表
export function loadRoomMembers() {
    // 获取当前聊天室RID
    const currentRoomId = localStorage.getItem('currentRoomId');
    // 检查roomId的有效性
    if (!currentRoomId || currentRoomId === 'undefined' || currentRoomId === 'null') {
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
        console.error('获取聊天室成员列表错误:', error);
        window.showMessage('获取成员列表失败: ' + error.message, 'danger');
    });
}

// 显示聊天室成员列表
export function displayRoomMembers(members) {
    const membersList = document.getElementById('membersList');
    if (!membersList) {
        console.warn('未找到成员列表容器');
        return;
    }
    
    if (!members || members.length === 0) {
        membersList.innerHTML = '<li class="list-group-item text-center text-muted">暂无成员</li>';
        return;
    }
    
    membersList.innerHTML = members.map(member => `
        <li class="list-group-item d-flex align-items-center">
            <img src="${member.avatarUrl || '/default-avatar.png'}" 
                 alt="头像" 
                 class="rounded-circle me-3" 
                 width="40" 
                 height="40"
                 onerror="this.src='/default-avatar.png'">
            <div class="flex-grow-1">
                <div class="fw-bold">${member.nickname || member.username}</div>
                <div class="text-muted small">@${member.username}</div>
                <div class="text-muted small">UID: ${member.uid || member.id}</div>
            </div>
            ${member.isCreator ? '<span class="badge bg-success">群主</span>' : ''}
            ${member.isModerator ? '<span class="badge bg-warning">管理员</span>' : ''}
        </li>
    `).join('');
}

// 搜索聊天室功能
export function searchRooms(query) {
    if (!query) {
        window.showMessage('请输入搜索关键词', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/search?q=${encodeURIComponent(query)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('搜索失败');
        }
        return response.json();
    })
    .then(data => {
        displaySearchResults(data.rooms);
    })
    .catch(error => {
        console.error('搜索聊天室失败:', error);
        window.showMessage('搜索失败，请稍后再试', 'danger');
    });
}

// 显示搜索结果
export function displaySearchResults(rooms) {
    const resultsContainer = document.getElementById('searchRoomResults');
    if (!resultsContainer) return;
    
    if (!rooms || rooms.length === 0) {
        resultsContainer.innerHTML = '<li class="list-group-item">未找到相关聊天室</li>';
        return;
    }
    
    resultsContainer.innerHTML = rooms.map(room => `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${room.name}</h6>
                    <small class="text-muted">ID: ${room.id} | 创建者: ${room.creatorNickname} | 成员: ${room.memberCount}人</small>
                </div>
                <button class="btn btn-sm btn-outline-primary" onclick="joinRoom(${room.id})">
                    加入
                </button>
            </div>
        </li>
    `).join('');
}

// 加入房间功能
export function joinRoom(roomId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    // 发送加入请求
    fetch(`/api/rooms/${roomId}/join-request`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(response => {
        return response.json().then(data => {
            if (!response.ok) {
                throw new Error(data.error || '加入聊天室失败');
            }
            return data;
        });
    })
    .then(result => {
        if (result.success) {
            window.showMessage(result.message || '加入请求已发送，等待房主审批', 'success');
        }
        // 重新加载聊天室列表
        if (typeof window.loadRooms === 'function') {
            window.loadRooms();
        }
        // 隐藏搜索模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('searchRoomModal'));
        if (modal) {
            modal.hide();
        }
    })
    .catch(error => {
        console.error('加入聊天室失败:', error);
        window.showMessage(error.message || '加入聊天室失败', 'danger');
    });
}

/**
 * 加载待审批请求
 */
export async function loadPendingRequests(roomId, token) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/pending-requests`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取待处理请求失败');
        }

        const requests = await response.json();
        displayPendingRequests(requests);
    } catch (error) {
        console.error('加载待审批请求失败:', error);
        showMessage('加载待审批请求失败: ' + error.message, 'danger');
    }
}

/**
 * 显示待审批请求
 */
export function displayPendingRequests(requests) {
    const container = document.getElementById('pendingRequestsContainer');
    const noRequestsMessage = document.getElementById('noRequestsMessage');
    const joinRequestsSection = document.getElementById('joinRequestsSection');
    
    if (!container) return;

    // 如果没有请求，显示"暂无请求"消息
    if (!requests || requests.length === 0) {
        if (noRequestsMessage) {
            noRequestsMessage.style.display = 'block';
        }
        container.innerHTML = '';
        if (joinRequestsSection) {
            joinRequestsSection.style.display = 'block';
        }
        return;
    }

    // 隐藏"暂无请求"消息
    if (noRequestsMessage) {
        noRequestsMessage.style.display = 'none';
    }

    let html = '';
    requests.forEach(request => {
        // 获取用户信息
        const user = request.User || {};
        
        html += `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <img src="${user.avatarUrl || '/default-avatar.png'}" 
                                 alt="头像" 
                                 class="rounded-circle me-3" 
                                 width="40" 
                                 height="40"
                                 onerror="this.src='/default-avatar.png'">
                            <div>
                                <h6 class="mb-1">${user.nickname || user.username || '未知用户'}</h6>
                                <p class="mb-1 text-muted small">@${user.username || 'unknown'}</p>
                                ${request.message ? `<p class="mb-1">${request.message}</p>` : ''}
                                <small class="text-muted">申请时间: ${new Date(request.requestTime).toLocaleString('zh-CN')}</small>
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-success approve-request-btn me-1" 
                                    data-user-id="${user.userId}"
                                    data-room-id="${request.roomId}">
                                <i class="bi bi-check"></i> 允许
                            </button>
                            <button class="btn btn-sm btn-danger reject-request-btn" 
                                    data-user-id="${user.userId}"
                                    data-room-id="${request.roomId}">
                                <i class="bi bi-x"></i> 拒绝
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    
    // 显示审批区域
    if (joinRequestsSection) {
        joinRequestsSection.style.display = 'block';
    }

    // 绑定批准和拒绝按钮事件
    document.querySelectorAll('.approve-request-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const roomId = this.getAttribute('data-room-id');
            handleJoinRequest(roomId, userId, 'approve');
        });
    });

    document.querySelectorAll('.reject-request-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const roomId = this.getAttribute('data-room-id');
            handleJoinRequest(roomId, userId, 'reject');
        });
    });
}

// 直接加入房间（无需审批）
function directJoinRoom(roomId, token) {
    return fetch(`/api/rooms/${roomId}/join-request`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '加入聊天室失败');
            });
        }
        return response.json();
    });
}
