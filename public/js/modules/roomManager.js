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
    const pendingRequestsList = document.getElementById('pendingRequestsList');
    if (!pendingRequestsList) return;

    if (!requests || requests.length === 0) {
        pendingRequestsList.innerHTML = '<li class="list-group-item text-center text-muted">暂无待处理请求</li>';
        return;
    }

    pendingRequestsList.innerHTML = '';
    requests.forEach(request => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${request.user.avatarUrl || '/default-avatar.png'}" 
                     alt="头像" 
                     class="rounded-circle me-2" 
                     width="32" 
                     height="32"
                     onerror="this.src='/default-avatar.png'">
                <div>
                    <div>${request.user.nickname || request.user.username}</div>
                    <small class="text-muted">申请时间: ${new Date(request.requestedAt).toLocaleString()}</small>
                </div>
            </div>
            <div>
                <button class="btn btn-sm btn-success me-1" 
                        onclick="handleJoinRequest('${request.roomId}', '${request.userId}', 'approve')">
                    允许
                </button>
                <button class="btn btn-sm btn-danger" 
                        onclick="handleJoinRequest('${request.roomId}', '${request.userId}', 'reject')">
                    拒绝
                </button>
            </div>
        `;
        pendingRequestsList.appendChild(li);
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
                note: formData.get('note') || '',
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

            fetch('/api/rooms/create', {
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
                        throw new Error(data.error || '创建失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                window.showMessage('聊天室创建成功', 'success');
                
                // 关闭模态框
                const createRoomModalEl = document.getElementById('createRoomModal');
                if (createRoomModalEl) {
                    const createRoomModal = bootstrap.Modal.getInstance(createRoomModalEl);
                    if (createRoomModal) {
                        createRoomModal.hide();
                    }
                }
                
                // 重新加载聊天室列表
                loadRooms();
            })
            .catch(error => {
                console.error('创建聊天室失败:', error);
                window.showMessage('创建聊天室失败: ' + error.message, 'danger');
            });
        });
    }
    
    // 绑定设置表单提交事件
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (!currentRoomId) {
                window.showMessage('请先选择一个聊天室', 'warning');
                return;
            }
            
            const formData = new FormData(settingsForm);
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
                        throw new Error(data.error || '更新失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                window.showMessage('设置已更新', 'success');
                
                // 关闭模态框
                const settingsModalEl = document.getElementById('settingsModal');
                if (settingsModalEl) {
                    const settingsModal = bootstrap.Modal.getInstance(settingsModalEl);
                    if (settingsModal) {
                        settingsModal.hide();
                    }
                }
                
                // 更新聊天室名称显示
                const currentRoomName = document.getElementById('currentRoomName');
                if (currentRoomName) {
                    currentRoomName.textContent = room.name;
                }
                
                // 重新加载聊天室列表
                loadRooms();
            })
            .catch(error => {
                console.error('更新设置失败:', error);
                window.showMessage('更新设置失败: ' + error.message, 'danger');
            });
        });
    }
}

// 搜索聊天室
function searchRooms(keyword) {
    if (!keyword.trim()) {
        loadRooms();
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/search?keyword=${encodeURIComponent(keyword)}`, {
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
    .then(rooms => {
        displayRooms(rooms);
    })
    .catch(error => {
        console.error('搜索聊天室失败:', error);
        window.showMessage('搜索聊天室失败: ' + error.message, 'danger');
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
    
    fetch(`/api/rooms/${currentRoomId}/members/${userId}/role`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
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