// 群聊页面 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    let currentGroup = null;
    let socket = null;
    let authToken = localStorage.getItem('token'); // 修改：统一使用'token'作为键名
    let userId = localStorage.getItem('userId');
    
    // DOM 元素
    const elements = {
        notificationArea: document.getElementById('notificationArea'),
        groupsList: document.getElementById('groupsList'),
        groupNav: document.querySelector('.card-header'),
        createGroupBtn: document.getElementById('createGroupBtn'),
        createGroupModal: document.getElementById('createGroupModal'),
        createGroupForm: document.getElementById('createGroupForm'),
        submitCreateGroup: document.getElementById('submitCreateGroup'),
        myGroupsView: document.querySelector('#groupDetailView').parentElement,
        groupDetailView: document.getElementById('groupDetailView'),
        backToGroups: document.getElementById('backToGroups'),
        backToGroupsFromSearch: document.getElementById('backToGroupsFromSearch'),
        groupTitle: document.getElementById('groupTitle'),
        groupDescription: document.getElementById('groupDescription'),
        groupMemberCount: document.getElementById('groupMemberCount'),
        groupCreatedAt: document.getElementById('groupCreatedAt'),
        groupOwner: document.getElementById('groupOwner'),
        groupAnnouncement: document.getElementById('groupAnnouncement'),
        groupMembersList: document.getElementById('groupMembersList'),
        groupChatMessages: document.getElementById('groupChatMessages'),
        messageInput: document.getElementById('messageInput'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        joinGroupBtn: document.getElementById('joinGroupBtn'),
        leaveGroupBtn: document.getElementById('leaveGroupBtn'),
        addGroupMemberBtn: document.getElementById('addGroupMemberBtn'),
        refreshMembers: document.getElementById('refreshMembers'),
        manageRequestsCard: document.getElementById('manageRequestsCard'),
        groupRequestsList: document.getElementById('groupRequestsList'),
        pendingRequestsCount: document.getElementById('pendingRequestsCount'),
        searchGroupsInput: document.getElementById('searchGroupsInput'),
        searchGroupsBtn: document.getElementById('searchGroupsBtn'),
        searchResultsView: document.getElementById('searchResultsView'),
        searchResultsList: document.getElementById('searchResultsList')
    };
    
    // 初始化
    init();
    
    function init() {
        if (!authToken) {
            showNotification('请先登录', 'error');
            window.location.href = '/login.html';
            return;
        }
        
        setupEventListeners();
        loadGroups();
        setupWebSocket();
    }
    
    function setupEventListeners() {
        // 创建群聊按钮
        elements.createGroupBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(elements.createGroupModal);
            modal.show();
        });
        
        // 提交创建群聊
        elements.submitCreateGroup.addEventListener('click', createGroup);
        
        // 返回群聊列表
        elements.backToGroups.addEventListener('click', () => {
            elements.groupDetailView.style.display = 'none';
            elements.myGroupsView.style.display = 'block';
            currentGroup = null;
            
            // 断开群聊WebSocket连接
            if (socket) {
                socket.emit('leave_group', currentGroup?.id);
            }
        });
        
        // 从搜索结果返回群聊列表
        elements.backToGroupsFromSearch.addEventListener('click', () => {
            elements.searchResultsView.style.display = 'none';
            elements.myGroupsView.style.display = 'block';
        });
        
        // 发送消息
        elements.sendMessageBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // 刷新成员列表
        elements.refreshMembers.addEventListener('click', () => {
            if (currentGroup) {
                loadGroupMembers(currentGroup.id);
            }
        });
        
        // 搜索群聊
        elements.searchGroupsBtn.addEventListener('click', searchGroups);
        elements.searchGroupsInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchGroups();
            }
        });
    }
    
    function setupWebSocket() {
        // 连接到WebSocket服务器
        // 注意：这里需要根据实际后端地址进行调整
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/connect`; // 修改：匹配后端路由
        
        socket = new WebSocket(wsUrl);
        
        // 设置认证头
        socket.onopen = function(event) {
            // 发送认证信息
            socket.send(JSON.stringify({
                type: 'auth',
                payload: { token: authToken }
            }));
            
            console.log('已连接到WebSocket服务器');
        };
        
        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'new_message') {
                    if (currentGroup && data.payload.receiver_type === 'group' && data.payload.receiver_id == currentGroup.id) {
                        displayGroupMessage(data.payload);
                    }
                }
            } catch (e) {
                console.error('解析WebSocket消息失败:', e);
            }
        };
        
        socket.onerror = function(error) {
            console.error('WebSocket错误:', error);
        };
        
        socket.onclose = function() {
            console.log('与WebSocket服务器断开连接');
        };
    }
    
    function showNotification(message, type = 'info') {
        // 清除现有通知
        elements.notificationArea.innerHTML = '';
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button class="close-btn">&times;</button>
        `;
        
        elements.notificationArea.appendChild(notification);
        
        // 添加关闭事件
        notification.querySelector('.close-btn').addEventListener('click', function() {
            notification.remove();
        });
        
        // 自动关闭通知（错误类型除外）
        if (type !== 'error') {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }
    }
    
    async function loadGroups() {
        try {
            const response = await fetch('/api/groups/list', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displayGroups(data.groups);
            } else {
                showNotification(data.error || '获取群聊列表失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayGroups(groups) {
        elements.groupsList.innerHTML = '';
        
        if (groups.length === 0) {
            elements.groupsList.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="bi bi-people fs-1"></i>
                        <p class="mt-3">您还没有加入任何群聊</p>
                        <button class="btn btn-primary" id="createFirstGroupBtn">创建第一个群聊</button>
                    </div>
                </div>
            `;
            document.getElementById('createFirstGroupBtn').addEventListener('click', () => {
                const modal = new bootstrap.Modal(elements.createGroupModal);
                modal.show();
            });
            return;
        }
        
        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'col-md-6 col-lg-12 mb-2';
            groupCard.innerHTML = `
                <div class="group-card card" onclick="selectGroup(${group.id})">
                    <div class="card-body d-flex align-items-center">
                        <img src="${group.avatar_url}" alt="群聊头像" class="group-avatar me-3">
                        <div class="group-info flex-grow-1">
                            <h6 class="card-title mb-1">${group.name}</h6>
                            <p class="card-text text-muted small mb-0">
                                <i class="bi bi-people"></i> ${group.member_count} 人 
                                <span class="mx-2">•</span>
                                <i class="bi bi-clock"></i> ${new Date(group.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            `;
            elements.groupsList.appendChild(groupCard);
        });
    }
    
    async function selectGroup(groupId) {
        try {
            // 获取群聊详情
            const response = await fetch(`/api/groups/list`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const group = data.groups.find(g => g.id == groupId);
                if (group) {
                    currentGroup = group;
                    displayGroupDetail(group);
                    
                    // 显示群聊详情视图
                    elements.myGroupsView.style.display = 'none';
                    elements.groupDetailView.style.display = 'block';
                    
                    // 加载成员列表
                    await loadGroupMembers(groupId);
                    
                    // 加载聊天记录
                    await loadGroupMessages(groupId);
                    
                    // 加入群聊房间
                    if (socket) {
                        socket.emit('join_group', groupId);
                    }
                }
            } else {
                showNotification(data.error || '获取群聊详情失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayGroupDetail(group) {
        elements.groupTitle.textContent = group.name;
        elements.groupDescription.textContent = group.description || '暂无描述';
        elements.groupMemberCount.textContent = group.member_count;
        elements.groupCreatedAt.textContent = new Date(group.created_at).toLocaleString();
        // 这里需要获取群主用户名，暂时显示ID
        elements.groupOwner.textContent = `ID: ${group.owner_id}`;
        elements.groupAnnouncement.textContent = group.announcement || '暂无公告';
        
        // 根据用户角色显示不同的按钮
        // 这里需要进一步从后端获取用户在群中的角色
        elements.joinGroupBtn.style.display = 'none';
        elements.leaveGroupBtn.style.display = 'inline-block';
        elements.addGroupMemberBtn.style.display = 'none';
        
        // 如果是群主或管理员，显示管理申请的卡片
        elements.manageRequestsCard.style.display = 'block';
        loadGroupRequests(group.id);
    }
    
    async function loadGroupMembers(groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}/members`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displayGroupMembers(data.members);
            } else {
                showNotification(data.error || '获取群成员列表失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayGroupMembers(members) {
        elements.groupMembersList.innerHTML = '';
        
        if (members.length === 0) {
            elements.groupMembersList.innerHTML = '<p class="text-muted">暂无成员</p>';
            return;
        }
        
        members.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item d-flex align-items-center mb-2';
            memberItem.innerHTML = `
                <img src="${member.avatar_url}" alt="${member.nickname}" class="rounded-circle me-2" width="30" height="30">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${member.nickname || member.username}</strong>
                            <span class="member-role role-${member.role} ms-2">${getRoleText(member.role)}</span>
                        </div>
                        <small class="text-muted">${member.is_mute ? '已禁言' : ''}</small>
                    </div>
                </div>
            `;
            elements.groupMembersList.appendChild(memberItem);
        });
    }
    
    function getRoleText(role) {
        switch(role) {
            case 'owner': return '群主';
            case 'admin': return '管理员';
            case 'member': return '成员';
            default: return '成员';
        }
    }
    
    async function loadGroupMessages(groupId) {
        try {
            const response = await fetch(`/api/message/history/group/${groupId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                elements.groupChatMessages.innerHTML = '';
                
                if (data.messages.length === 0) {
                    elements.groupChatMessages.innerHTML = '<div class="text-center text-muted py-5">暂无消息记录</div>';
                    return;
                }
                
                data.messages.forEach(message => {
                    displayGroupMessage(message);
                });
                
                // 滚动到底部
                elements.groupChatMessages.scrollTop = elements.groupChatMessages.scrollHeight;
            } else {
                showNotification(data.error || '加载聊天记录失败', 'error');
            }
        } catch (error) {
            console.error('加载群聊消息失败:', error);
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayGroupMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id == userId ? 'sent' : 'received'}`;
        
        const sender = message.sender_name || `用户${message.sender_id}`;
        const content = message.content || message.file_name || '未知消息类型';
        const time = new Date(message.sent_at).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div><strong>${sender}</strong></div>
            <div>${content}</div>
            <div class="message-info">${time}</div>
        `;
        
        elements.groupChatMessages.appendChild(messageElement);
        elements.groupChatMessages.scrollTop = elements.groupChatMessages.scrollHeight;
    }
    
    async function sendMessage() {
        if (!currentGroup || !elements.messageInput.value.trim()) return;
        
        const content = elements.messageInput.value.trim();
        
        if (socket) {
            const message = {
                type: 'send_message',
                payload: {
                    sender_id: userId,
                    receiver_type: 'group',
                    receiver_id: currentGroup.id,
                    content: content,
                    message_type: 'text'
                }
            };
            
            socket.send(JSON.stringify(message));
            
            // 清空输入框
            elements.messageInput.value = '';
        }
    }
    
    async function createGroup() {
        const name = document.getElementById('groupName').value;
        const description = document.getElementById('groupDescription').value;
        const avatar = document.getElementById('groupAvatar').value;
        const needApproval = document.getElementById('needApproval').checked;
        const isPrivate = document.getElementById('isPrivate').checked;
        
        if (!name) {
            showNotification('请输入群聊名称', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/groups/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description,
                    avatar_url: avatar,
                    need_approval: needApproval,
                    is_private: isPrivate
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('群聊创建成功', 'success');
                const modal = bootstrap.Modal.getInstance(elements.createGroupModal);
                modal.hide();
                
                // 重新加载群聊列表
                loadGroups();
                
                // 清空表单
                elements.createGroupForm.reset();
                document.getElementById('groupAvatar').value = '/default/group.png';
                document.getElementById('needApproval').checked = true;
                document.getElementById('isPrivate').checked = false;
            } else {
                showNotification(data.error || '创建群聊失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    async function searchGroups() {
        const keyword = elements.searchGroupsInput.value.trim();
        
        if (!keyword) {
            showNotification('请输入搜索关键词', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/groups/search?keyword=${encodeURIComponent(keyword)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 显示搜索结果视图
                elements.myGroupsView.style.display = 'none';
                elements.searchResultsView.style.display = 'block';
                
                displaySearchResults(data.groups);
            } else {
                showNotification(data.error || '搜索群聊失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displaySearchResults(groups) {
        elements.searchResultsList.innerHTML = '';
        
        if (groups.length === 0) {
            elements.searchResultsList.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-search fs-1 text-muted"></i>
                    <p class="mt-3 text-muted">没有找到匹配的群聊</p>
                </div>
            `;
            return;
        }
        
        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'card mb-3';
            groupCard.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h6 class="card-title">${group.name}</h6>
                            <p class="card-text text-muted small">${group.description || '暂无描述'}</p>
                            <p class="card-text text-muted small">
                                <i class="bi bi-people"></i> ${group.member_count} 人 
                                <span class="mx-2">•</span>
                                <i class="bi bi-clock"></i> ${new Date(group.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div class="d-flex align-items-center">
                            <button class="btn btn-sm ${group.joined ? 'btn-secondary' : 'btn-primary'}" 
                                    onclick="joinOrLeaveGroup(${group.id}, ${group.joined})"
                                    ${group.joined ? 'disabled' : ''}>
                                ${group.joined ? '已加入' : '加入群聊'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            elements.searchResultsList.appendChild(groupCard);
        });
    }
    
    async function joinOrLeaveGroup(groupId, joined) {
        if (joined) {
            // 退出群聊逻辑（这里简化处理，实际可能需要确认）
            try {
                const response = await fetch(`/api/groups/${groupId}/leave`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification('已退出群聊', 'info');
                    loadGroups(); // 重新加载群聊列表
                } else {
                    showNotification(data.error || '退出群聊失败', 'error');
                }
            } catch (error) {
                showNotification('网络错误: ' + error.message, 'error');
            }
        } else {
            // 加入群聊逻辑
            try {
                const response = await fetch(`/api/groups/${groupId}/join`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: '申请加入群聊'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification(data.message, 'success');
                    searchGroups(); // 重新执行搜索以更新状态
                } else {
                    showNotification(data.error || '加入群聊失败', 'error');
                }
            } catch (error) {
                showNotification('网络错误: ' + error.message, 'error');
            }
        }
    }
    
    async function loadGroupRequests(groupId) {
        try {
            const response = await fetch(`/api/groups/${groupId}/requests`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displayGroupRequests(data.requests);
                elements.pendingRequestsCount.textContent = data.requests.length;
            } else {
                // 如果没有权限（例如不是管理员），隐藏管理申请卡片
                elements.manageRequestsCard.style.display = 'none';
            }
        } catch (error) {
            console.error('加载群聊申请失败:', error);
            elements.manageRequestsCard.style.display = 'none';
        }
    }
    
    function displayGroupRequests(requests) {
        elements.groupRequestsList.innerHTML = '';
        
        if (requests.length === 0) {
            elements.groupRequestsList.innerHTML = '<p class="text-muted">暂无申请</p>';
            return;
        }
        
        requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded';
            requestItem.innerHTML = `
                <div>
                    <div><strong>${request.nickname || request.username}</strong></div>
                    <small class="text-muted">${request.message || '申请加入群聊'}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-success me-1" onclick="handleGroupRequest(${request.id}, 'accept')">同意</button>
                    <button class="btn btn-sm btn-danger" onclick="handleGroupRequest(${request.id}, 'reject')">拒绝</button>
                </div>
            `;
            elements.groupRequestsList.appendChild(requestItem);
        });
    }
    
    async function handleGroupRequest(requestId, action) {
        try {
            const response = await fetch(`/api/groups/request/${requestId}/handle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: action
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(`已${action === 'accept' ? '同意' : '拒绝'}申请`, 'success');
                if (currentGroup) {
                    loadGroupRequests(currentGroup.id);
                }
            } else {
                showNotification(data.error || '处理申请失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    // 全局函数，供HTML中调用
    window.selectGroup = selectGroup;
    window.joinOrLeaveGroup = joinOrLeaveGroup;
    window.handleGroupRequest = handleGroupRequest;
});