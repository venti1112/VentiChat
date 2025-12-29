// 主聊天页面 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // 全局变量
    let currentChat = null;
    let currentChatType = null; // 'friend' 或 'group'
    let socket = null;
    let authToken = localStorage.getItem('token'); // 修改：统一使用'token'作为键名
    let userId = localStorage.getItem('userId');
    let currentUser = null;
    
    // DOM 元素
    const elements = {
        notificationArea: document.getElementById('notificationArea'),
        currentUserAvatar: document.getElementById('currentUserAvatar'),
        currentUserName: document.getElementById('currentUserName'),
        friendsList: document.getElementById('friendsList'),
        groupsList: document.getElementById('groupsList'),
        chatTitle: document.getElementById('chatTitle'),
        chatAvatar: document.getElementById('chatAvatar'),
        chatMessages: document.getElementById('chatMessages'),
        messageInput: document.getElementById('messageInput'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        newChatBtn: document.getElementById('newChatBtn'),
        profileBtn: document.getElementById('profileBtn'),
        selectFriend: document.getElementById('selectFriend'),
        selectGroup: document.getElementById('selectGroup'),
        startChatBtn: document.getElementById('startChatBtn'),
        newChatModal: document.getElementById('newChatModal')
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
        loadCurrentUser();
        loadFriendsAndGroups();
        setupWebSocket();
    }
    
    function setupEventListeners() {
        // 发送消息
        elements.sendMessageBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // 新建聊天按钮
        elements.newChatBtn.addEventListener('click', loadChatOptions);
        
        // 开始聊天按钮
        elements.startChatBtn.addEventListener('click', startNewChat);
        
        // 个人资料按钮
        elements.profileBtn.addEventListener('click', () => {
            window.location.href = '/profile.html'; // 假设有一个个人资料页面
        });
        
        // 登出按钮 - 添加事件监听器
        setupLogout();
    }
    
    function setupWebSocket() {
        // 连接到WebSocket服务器
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 将认证令牌作为查询参数传递
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/connect?token=${encodeURIComponent(authToken)}`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function(event) {
            console.log('已连接到WebSocket服务器');
        };
        
        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'new_message') {
                    // 检查是否是当前聊天的消息
                    if (currentChat && 
                        data.payload.receiver_type === currentChatType && 
                        data.payload.receiver_id == currentChat.id) {
                        displayMessage(data.payload);
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
            // 尝试重连
            setTimeout(setupWebSocket, 3000);
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
    
    async function loadCurrentUser() {
        // 检查userId是否有效
        if (!userId || userId === 'null') {
            showNotification('用户ID无效', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentUser = data;
                const displayName = data.nickname || data.username || 'Unknown';
                elements.currentUserName.textContent = displayName;
                elements.currentUserAvatar.textContent = displayName.charAt(0).toUpperCase();
            } else {
                showNotification(data.error || '获取用户信息失败', 'error');
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
            showNotification('获取用户信息失败', 'error');
        }
    }
    
    async function loadFriendsAndGroups() {
        try {
            // 加载好友列表
            const friendsResponse = await fetch('/api/friends', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const friendsData = await friendsResponse.json();
            
            if (friendsResponse.ok) {
                displayFriends(friendsData.friends);
            } else {
                showNotification(friendsData.error || '获取好友列表失败', 'error');
            }
            
            // 加载群聊列表
            const groupsResponse = await fetch('/api/groups/list', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const groupsData = await groupsResponse.json();
            
            if (groupsResponse.ok) {
                displayGroups(groupsData.groups);
            } else {
                showNotification(groupsData.error || '获取群聊列表失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayFriends(friends) {
        elements.friendsList.innerHTML = '';
        
        if (friends.length === 0) {
            elements.friendsList.innerHTML = '<div class="text-center py-3 text-muted">暂无好友</div>';
            return;
        }
        
        friends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'contact-item';
            friendItem.dataset.friendId = friend.id;
            friendItem.innerHTML = `
                <div class="contact-avatar">${(friend.nickname || friend.username).charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${friend.nickname || friend.username}</div>
                    <div class="contact-preview">点击开始聊天</div>
                </div>
                <div class="contact-time"></div>
            `;
            
            friendItem.addEventListener('click', () => {
                selectChat(friend, 'friend');
            });
            
            elements.friendsList.appendChild(friendItem);
        });
    }
    
    function displayGroups(groups) {
        elements.groupsList.innerHTML = '';
        
        if (groups.length === 0) {
            elements.groupsList.innerHTML = '<div class="text-center py-3 text-muted">暂无群聊</div>';
            return;
        }
        
        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'contact-item';
            groupItem.dataset.groupId = group.id;
            groupItem.innerHTML = `
                <div class="contact-avatar">${group.name.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${group.name}</div>
                    <div class="contact-preview">${group.member_count} 人 · 群聊</div>
                </div>
                <div class="contact-time"></div>
            `;
            
            groupItem.addEventListener('click', () => {
                selectChat(group, 'group');
            });
            
            elements.groupsList.appendChild(groupItem);
        });
    }
    
    function selectChat(chat, type) {
        currentChat = chat;
        currentChatType = type;
        
        // 更新聊天标题和头像
        elements.chatTitle.textContent = chat.name || chat.nickname || chat.username;
        elements.chatAvatar.textContent = (chat.name || chat.nickname || chat.username).charAt(0).toUpperCase();
        
        // 启用消息输入
        elements.messageInput.disabled = false;
        elements.sendMessageBtn.disabled = false;
        
        // 清空当前消息
        elements.chatMessages.innerHTML = '';
        
        // 加载聊天历史
        loadChatHistory();
        
        // 在侧边栏中高亮选中的项目
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (type === 'friend') {
            const selected = document.querySelector(`.contact-item[data-friend-id="${chat.id}"]`);
            if (selected) selected.classList.add('active');
        } else {
            const selected = document.querySelector(`.contact-item[data-group-id="${chat.id}"]`);
            if (selected) selected.classList.add('active');
        }
        
        // 加入聊天房间
        if (socket) {
            socket.send(JSON.stringify({
                type: 'join_room',
                payload: { type: type, id: chat.id }
            }));
        }
    }
    
    async function loadChatHistory() {
        if (!currentChat) return;
        
        try {
            const response = await fetch(`/api/message/history/${currentChatType}/${currentChat.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                elements.chatMessages.innerHTML = '';
                
                // 验证data.messages是否存在且为数组
                if (!data.messages || !Array.isArray(data.messages)) {
                    elements.chatMessages.innerHTML = '<div class="text-center text-muted py-5">暂无消息记录</div>';
                    return;
                }
                
                if (data.messages.length === 0) {
                    elements.chatMessages.innerHTML = '<div class="text-center text-muted py-5">暂无消息记录</div>';
                    return;
                }
                
                data.messages.forEach(message => {
                    displayMessage(message);
                });
                
                // 滚动到底部
                elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
            } else {
                showNotification(data.error || '加载聊天记录失败', 'error');
            }
        } catch (error) {
            console.error('加载聊天历史失败:', error);
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function displayMessage(message) {
        // 移除空聊天提示
        if (elements.chatMessages.querySelector('.empty-chat')) {
            elements.chatMessages.innerHTML = '';
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id == userId ? 'message-sent' : 'message-received'}`;
        
        const sender = message.sender_name || `用户${message.sender_id}`;
        const content = message.content || message.file_name || '未知消息类型';
        const time = new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div>${content}</div>
            <div class="message-info">${time}</div>
        `;
        
        elements.chatMessages.appendChild(messageElement);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    async function sendMessage() {
        if (!currentChat || !elements.messageInput.value.trim()) return;
        
        const content = elements.messageInput.value.trim();
        
        if (socket) {
            const message = {
                type: 'send_message',
                payload: {
                    sender_id: userId,
                    receiver_type: currentChatType,
                    receiver_id: currentChat.id,
                    content: content,
                    message_type: 'text'
                }
            };
            
            socket.send(JSON.stringify(message));
            
            // 清空输入框
            elements.messageInput.value = '';
        }
    }
    
    function loadChatOptions() {
        loadFriendsForNewChat();
        loadGroupsForNewChat();
        
        const modal = new bootstrap.Modal(elements.newChatModal);
        modal.show();
    }
    
    async function loadFriendsForNewChat() {
        try {
            const response = await fetch('/api/friends', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                elements.selectFriend.innerHTML = '';
                
                if (data.friends.length === 0) {
                    elements.selectFriend.innerHTML = '<option value="">暂无好友可选</option>';
                    return;
                }
                
                data.friends.forEach(friend => {
                    const option = document.createElement('option');
                    option.value = friend.id;
                    option.textContent = friend.nickname || friend.username;
                    elements.selectFriend.appendChild(option);
                });
            } else {
                elements.selectFriend.innerHTML = '<option value="">加载失败</option>';
                showNotification(data.error || '获取好友列表失败', 'error');
            }
        } catch (error) {
            elements.selectFriend.innerHTML = '<option value="">网络错误</option>';
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    async function loadGroupsForNewChat() {
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
                elements.selectGroup.innerHTML = '';
                
                if (data.groups.length === 0) {
                    elements.selectGroup.innerHTML = '<option value="">暂无群聊可选</option>';
                    return;
                }
                
                data.groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    elements.selectGroup.appendChild(option);
                });
            } else {
                elements.selectGroup.innerHTML = '<option value="">加载失败</option>';
                showNotification(data.error || '获取群聊列表失败', 'error');
            }
        } catch (error) {
            elements.selectGroup.innerHTML = '<option value="">网络错误</option>';
            showNotification('网络错误: ' + error.message, 'error');
        }
    }
    
    function startNewChat() {
        const activeTab = document.querySelector('#chatTabs .nav-link.active').href.split('#')[1];
        
        if (activeTab === 'newFriendChat') {
            const friendId = elements.selectFriend.value;
            if (!friendId) {
                showNotification('请选择好友', 'error');
                return;
            }
            
            // 在好友列表中找到该好友
            const friendItems = document.querySelectorAll('#friendsTab .contact-item');
            for (const item of friendItems) {
                if (item.dataset.friendId === friendId) {
                    item.click();
                    break;
                }
            }
        } else {
            const groupId = elements.selectGroup.value;
            if (!groupId) {
                showNotification('请选择群聊', 'error');
                return;
            }
            
            // 在群聊列表中找到该群聊
            const groupItems = document.querySelectorAll('#groupsTab .contact-item');
            for (const item of groupItems) {
                if (item.dataset.groupId === groupId) {
                    item.click();
                    break;
                }
            }
        }
        
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(elements.newChatModal);
        modal.hide();
    }
    
    // 登出功能
    function setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async function() {
                // 确认登出
                if (confirm('确定要退出登录吗？')) {
                    try {
                        // 调用后端登出接口，删除服务器上的认证令牌
                        const response = await fetch('/api/auth/logout', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            }
                        });
                        
                        // 无论后端登出是否成功，都清除本地认证信息
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                        
                        if (response.ok) {
                            const result = await response.json();
                            showNotification(result.message || '已退出登录', 'info');
                        } else {
                            // 即使后端登出失败，也提示用户本地已退出
                            showNotification('已退出登录（服务器令牌可能未及时清除）', 'warning');
                        }
                    } catch (error) {
                        // 网络错误等情况，仍然清除本地认证信息
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                        showNotification('已退出登录（网络错误）', 'warning');
                    }
                    
                    // 延迟跳转到登录页
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 1000);
                }
            });
        }
    }
    
});