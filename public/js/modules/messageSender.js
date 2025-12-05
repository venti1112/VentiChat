// 消息发送模块

// 存储正在发送的消息的临时ID
const pendingMessages = new Set();

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
    
    // 生成临时消息ID
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 禁用发送按钮并显示发送中提示
    const sendBtn = document.getElementById('sendBtn');
    let originalSendBtnContent = '';
    if (sendBtn) {
        originalSendBtnContent = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 发送中...';
    }
    
    // 将临时ID添加到待处理列表
    pendingMessages.add(tempId);
    
    // 创建临时消息对象用于立即显示
    const tempMessage = {
        id: tempId,
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
    
    // 立即显示临时消息
    window.displayMessages([tempMessage]).then(() => {
        // 滚动到底部
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
    
    // 发送消息到服务器
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            roomId: parseInt(currentRoomId), // 确保roomId是数字类型
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
        // 清空输入框
        if (messageInput) messageInput.value = '';
        
        // 用服务器返回的真实消息替换临时消息
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempId}"]`);
            if (tempMessageElement) {
                window.renderMessage(data).then(renderedMessage => {
                    tempMessageElement.outerHTML = `
                        <div class="message-item mb-3" data-message-id="${data.id}">
                            ${renderedMessage}
                        </div>
                    `;
                });
            }
        }
        
        // 恢复发送按钮
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalSendBtnContent || '<i class="bi bi-send"></i>';
        }
        
        // 从待处理列表中移除
        pendingMessages.delete(tempId);
    })
    .catch(error => {
        window.showMessage(error.message || '发送消息失败', 'danger');
        
        // 移除临时消息
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempId}"]`);
            if (tempMessageElement) {
                tempMessageElement.remove();
            }
        }
        
        // 恢复发送按钮
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalSendBtnContent || '<i class="bi bi-send"></i>';
        }
        
        // 从待处理列表中移除
        pendingMessages.delete(tempId);
    });
}

// 检查消息是否正在发送中
export function isMessagePending(tempId) {
    return pendingMessages.has(tempId);
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
        attachFileBtn.addEventListener('click', function() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.onchange = window.handleFileSelect;
            fileInput.click();
        });
    }
}