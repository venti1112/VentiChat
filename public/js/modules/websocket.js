// WebSocket管理模块

// 初始化WebSocket连接
export function initializeWebSocket(token) {
    if (!token) {
        console.warn('未提供token，无法建立WebSocket连接');
        return;
    }
    
    // 创建WebSocket连接
    const socket = io({
        auth: {
            token: token
        }
    });
    
    window.socket = socket;
    
    // 监听连接事件
    socket.on('connect', () => {
        console.info('WebSocket连接成功');
        
        // 如果有当前聊天室，加入该聊天室
        const currentRoomId = localStorage.getItem('currentRoomId');
        if (currentRoomId) {
            socket.emit('joinRoom', {roomId: currentRoomId});
        }
    });

    // 添加自动刷新机制
    let refreshInterval = null;
    
    // 开始自动刷新
    function startAutoRefresh() {
        // 清除现有的定时器（如果有的话）
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        
        // 每5秒检查一次新消息
        refreshInterval = setInterval(async () => {
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (currentRoomId && token) {
                try {
                    const response = await fetch(`/api/messages/${currentRoomId}/history?limit=10`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const messages = data.messages || data;
                        
                        // 检查是否有新消息
                        const chatMessages = document.getElementById('chatMessages');
                        if (chatMessages && messages.length > 0) {
                            // 获取当前显示的消息ID列表
                            const displayedMessageIds = Array.from(
                                chatMessages.querySelectorAll('.message-item')
                            ).map(el => el.dataset.messageId);
                            
                            // 找出新消息
                            const newMessages = messages.filter(msg => 
                                !displayedMessageIds.includes(String(msg.messageId || msg.id))
                            );
                            
                            // 如果有新消息，添加到聊天界面
                            if (newMessages.length > 0) {
                                await window.displayMessages(newMessages);
                                
                                // 滚动到底部
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }
                        }
                    }
                } catch (error) {
                    console.error('自动刷新消息失败:', error);
                }
            }
        }, 5000); // 每5秒刷新一次
    }
    
    // 停止自动刷新
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }
    
    // 当加入房间时启动自动刷新
    socket.on('joinRoom', () => {
        startAutoRefresh();
    });
    
    // 页面隐藏时停止刷新，显示时恢复刷新
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
    });
    
    // 监听新消息事件
    socket.on('newMessage', async (message) => {
        console.info('收到新消息:', message);
        // 检查是否是当前聊天室的消息
        const currentRoomId = localStorage.getItem('currentRoomId');
        if (currentRoomId && currentRoomId == message.roomId) {
            // 显示新消息（等待异步渲染完成）
            await window.displayMessages([message]);
            
            // 滚动到底部
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } else {
            // 不是当前聊天室的消息，更新房间列表中的未读数
            console.info('收到其他房间消息，当前房间ID:', currentRoomId);
            updateRoomUnreadCount(message.roomId);
        }
    });
    
    // 监听消息撤回事件
    socket.on('messageRecalled', (data) => {
        const messageElements = document.querySelectorAll(`.message-item[data-message-id="${data.messageId}"]`);
        messageElements.forEach(element => {
            window.renderMessage({
                id: data.messageId,
                type: 'recall',
                content: '[已撤回]'
            }).then(renderedMessage => {
                element.innerHTML = renderedMessage;
            });
        });
    });
    
    // 监听未读计数更新事件
    socket.on('unreadCountUpdate', (data) => {
        // 更新未读计数显示
        updateUnreadCount(data.count);
    });
    
    // 监听连接错误事件
    socket.on('connect_error', (error) => {
        console.error('WebSocket连接错误:', error);
    });
    
    // 监听断开连接事件
    socket.on('disconnect', () => {
        console.info('WebSocket连接断开');
    });
    
    return socket;
}

// 更新未读计数显示
export function updateUnreadCount(count) {
    // 这里可以更新UI上的未读计数显示
    console.info('未读消息数更新:', count);
}

// 更新房间未读数显示
export function updateRoomUnreadCount(roomId) {
    // 获取房间列表中对应的房间项
    const roomItem = document.querySelector(`#room-${roomId}`);
    if (roomItem) {
        // 查找未读数标记元素
        let unreadBadge = roomItem.querySelector('.unread-badge');
        if (!unreadBadge) {
            // 如果不存在未读数标记，则创建一个
            unreadBadge = document.createElement('span');
            unreadBadge.className = 'unread-badge badge bg-danger ms-2';
            unreadBadge.textContent = '1';
            // 将未读数标记添加到房间项中
            const roomNameSpan = roomItem.querySelector('.room-name');
            if (roomNameSpan) {
                roomNameSpan.appendChild(unreadBadge);
            }
        } else {
            // 如果存在未读数标记，则增加计数
            const currentCount = parseInt(unreadBadge.textContent) || 0;
            unreadBadge.textContent = currentCount + 1;
        }
    }
}