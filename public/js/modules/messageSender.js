// 消息发送模块

// 用于映射临时消息ID到实际消息内容
const tempMessageMap = new Map();

// 发送消息函数
export function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const currentRoomId = localStorage.getItem('currentRoomId');
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    if (!currentRoomId) {
        window.showMessage('请先选择一个聊天室', 'warning');
        return;
    }
    
    const content = messageInput.value.trim();
    if (!content) {
        window.showMessage('消息内容不能为空', 'warning');
        return;
    }
    
    // 检查文字消息长度
    if (content.length > 4096) {
        window.showMessage('消息内容不能超过4096个字符', 'warning');
        return;
    }
    
    // 获取当前用户信息
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // 生成唯一的临时消息ID
    const tempMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 保存临时消息映射
    tempMessageMap.set(tempMessageId, content);
    
    // 创建临时消息对象用于立即显示
    const tempMessage = {
        id: tempMessageId,
        content: content,
        type: 'text',
        sentAt: new Date().toISOString(),
        Sender: {
            id: currentUser.id,
            nickname: currentUser.nickname || currentUser.username,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl || '/default-avatar.png'
        }
    };
    
    // 立即显示消息并添加临时标识
    window.displayMessages([tempMessage]).then(() => {
        // 给临时消息添加特殊类名，便于后续查找
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessageId}"]`);
            if (tempMessageElement) {
                tempMessageElement.classList.add('temp-message');
            }
        }
    });
    
    // 优先通过WebSocket发送消息
    if (window.socket && window.socket.connected) {
        // 监听一次messageSent事件来替换临时消息
        window.socket.once('messageSent', (data) => {
            // 用服务器返回的真实消息替换临时消息
            replaceTempMessage(tempMessageId, data);
            
            // 清空输入框
            if (messageInput) messageInput.value = '';
        });
        
        // 监听一次errorMessage事件来处理错误
        window.socket.once('errorMessage', (error) => {
            window.showMessage(error.message || '发送消息失败', 'danger');
            
            // 移除临时消息
            removeTempMessage(tempMessageId);
        });
        
        // 发送消息到服务器
        window.socket.emit('sendMessage', {
            rid: parseInt(currentRoomId),
            content: content,
            type: 'text'
        });
        
        console.log('Message sent via WebSocket');
        return;
    }
    
    // 如果WebSocket不可用，使用HTTP请求发送消息
    // 发送消息到服务器
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            roomId: parseInt(currentRoomId),
            content: content,
            type: 'text'
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '发送失败');
            });
        }
        return response.json();
    })
    .then(data => {
        // 用服务器返回的真实消息替换临时消息
        replaceTempMessage(tempMessageId, data);
        
        // 清空输入框
        if (messageInput) messageInput.value = '';
    })
    .catch(error => {
        window.showMessage(error.message || '发送消息失败', 'danger');
        
        // 移除临时消息
        removeTempMessage(tempMessageId);
    });
}

// 用真实消息替换临时消息
function replaceTempMessage(tempMessageId, realMessage) {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessageId}"]`);
        if (tempMessageElement) {
            window.renderMessage(realMessage).then(renderedMessage => {
                tempMessageElement.outerHTML = `
                    <div class="message-item mb-3" data-message-id="${realMessage.id}">
                        ${renderedMessage}
                    </div>
                `;
            });
        }
    }
    
    // 从映射中移除
    tempMessageMap.delete(tempMessageId);
}

// 移除临时消息
function removeTempMessage(tempMessageId) {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessageId}"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
    }
    
    // 从映射中移除
    tempMessageMap.delete(tempMessageId);
}

// 绑定发送消息相关事件
export function bindSendMessageEvents() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // 发送按钮点击事件
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // 消息输入框回车事件
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // 文件上传按钮事件
    const attachFileBtn = document.getElementById('attachFileBtn');
    if (attachFileBtn) {
        attachFileBtn.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
    }
}