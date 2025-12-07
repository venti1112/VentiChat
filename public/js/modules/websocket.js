// WebSocket管理模块

// 当前房间ID
let currentRoomId = null;

// 存储所有消息
let allMessages = [];

// 存储已发送消息的ID，避免重复显示自己发送的消息
const sentMessageIds = new Set();

// 更新WebSocket连接状态指示器
function updateWebSocketIndicator(connected) {
    const indicator = document.getElementById('websocketIndicator');
    if (indicator) {
        const icon = indicator.querySelector('i');
        if (connected) {
            icon.className = 'bi bi-plug-fill text-success';
            icon.title = '已与服务器建立实时通信连接';
        } else {
            icon.className = 'bi bi-plug-fill text-danger';
            icon.title = '与服务器建立实时通信连接失败，消息接收可能会产生较大延迟！';
        }
    }
}

// 初始化WebSocket连接
export function initializeWebSocket(token) {
    // 初始状态下设置为未连接
    updateWebSocketIndicator(false);
    
    if (!token) {
        console.error('Missing token for WebSocket connection');
        return null;
    }
    
    // 如果已经有socket连接，先断开
    if (window.socket) {
        window.socket.disconnect();
    }
    
    // 创建WebSocket连接
    const socket = io({
        auth: {
            token: token
        },
        transports: ['websocket', 'polling'], // 先尝试websocket，再尝试轮询
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
    });
    
    window.socket = socket;
    
    // 监听连接事件
    socket.on('connect', () => {
        console.log('WebSocket connected successfully, socket id:', socket.id);
        updateWebSocketIndicator(true);
        
        // 如果有当前聊天室，加入该聊天室
        const storedRoomId = localStorage.getItem('currentRoomId');
        if (storedRoomId) {
            joinRoom(storedRoomId);
        }
    });

    // 监听连接错误
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        updateWebSocketIndicator(false);
    });

    // 监听断开连接
    socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected, reason:', reason);
        updateWebSocketIndicator(false);
        // 尝试重新连接
        if (reason === 'io server disconnect') {
            // 服务器主动断开，尝试重连
            socket.connect();
        }
    });

    // 监听认证错误
    socket.on('unauthorized', (error) => {
        console.error('WebSocket authentication failed:', error);
        updateWebSocketIndicator(false);
        window.showMessage('认证失败，请重新登录', 'danger');
        // 清除本地存储并跳转到登录页面
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        window.location.reload();
    });

    // 监听新消息事件
    socket.on('newMessage', async (message) => {
        console.log('Received new message:', message);
        
        try {
            // 将消息添加到所有消息列表中
            allMessages.push(message);
            // 更新本地存储
            localStorage.setItem('allMessages', JSON.stringify(allMessages));
            
            // 检查是否是当前聊天室的消息
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (currentRoomId && String(currentRoomId) === String(message.roomId)) {
                // 显示新消息（等待异步渲染完成）
                await window.displayMessages([message]);
                
                // 滚动到底部
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                // 不是当前聊天室的消息，更新房间列表中的未读数
                updateRoomUnreadCount(message.roomId);
            }
        } catch (error) {
            console.error('Error processing new message:', error);
        }
    });
    
    // 监听消息发送确认事件
    socket.on('messageSent', (data) => {
        console.log('Message sent confirmed:', data);
        // 触发自定义事件，让messageSender.js处理临时消息替换
        window.dispatchEvent(new CustomEvent('messageSentSuccess', { detail: data }));
    });

    // 监听消息撤回事件
    socket.on('messageRecalled', (data) => {
        console.log('Received message recall notification:', data);
        try {
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
        } catch (error) {
            console.error('处理消息撤回时出错:', error);
        }
    });
    
    // 监听错误消息
    socket.on('errorMessage', (error) => {
        console.error('WebSocket error:', error);
        window.showMessage('错误: ' + (error.message || '未知错误'), 'danger');
    });
    
    // 监听连接成功事件
    socket.on('connected', (data) => {
        console.log('WebSocket连接成功:', data);
    });
    
    return socket;
}

// 加入房间
export function joinRoom(roomId) {
    if (window.socket && window.socket.connected) {
        window.socket.emit('joinRoom', { roomId: parseInt(roomId) });
        console.log('尝试加入房间:', roomId);
    } else {
        console.warn('WebSocket未连接，无法加入房间');
    }
}

// 离开房间
export function leaveRoom(roomId) {
    if (window.socket && window.socket.connected) {
        window.socket.emit('leaveRoom', { roomId: parseInt(roomId) });
        console.log('尝试离开房间:', roomId);
    } else {
        console.warn('WebSocket未连接，无法离开房间');
    }
}

// 更新房间未读数
export function updateRoomUnreadCount(roomId) {
    const roomItem = document.querySelector(`.room-item[data-room-id="${roomId}"]`);
    if (roomItem) {
        const unreadBadge = roomItem.querySelector('.unread-badge');
        if (unreadBadge) {
            const currentCount = parseInt(unreadBadge.textContent) || 0;
            unreadBadge.textContent = currentCount + 1;
            unreadBadge.style.display = 'inline-block';
        }
    }
}

// 更新全局未读数
export function updateUnreadCount(count) {
    const unreadCountElement = document.getElementById('unreadCount');
    if (unreadCountElement) {
        unreadCountElement.textContent = count;
        unreadCountElement.style.display = count > 0 ? 'inline-block' : 'none';
    }
}