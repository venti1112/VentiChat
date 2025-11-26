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