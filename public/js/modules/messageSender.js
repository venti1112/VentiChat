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
        console.log('通过WebSocket发送消息');
        
        // 监听一次messageSent事件来替换临时消息
        const messageSentHandler = (data) => {
            console.log('收到消息发送确认:', data);
            // 用服务器返回的真实消息替换临时消息
            replaceTempMessage(tempMessageId, data);
            
            // 清空输入框
            if (messageInput) messageInput.value = '';
            
            // 清理事件监听器
            window.socket.off('messageSent', messageSentHandler);
            window.socket.off('errorMessage', errorHandler);
        };
        
        // 监听一次errorMessage事件来处理错误
        const errorHandler = (error) => {
            console.error('发送消息失败:', error);
            window.showMessage(error.message || '发送消息失败', 'danger');
            
            // 移除临时消息
            removeTempMessage(tempMessageId);
            
            // 清理事件监听器
            window.socket.off('messageSent', messageSentHandler);
            window.socket.off('errorMessage', errorHandler);
        };
        
        // 注册事件监听器
        window.socket.once('messageSent', messageSentHandler);
        window.socket.once('errorMessage', errorHandler);
        
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
    fetch(`/api/messages/${parseInt(currentRoomId)}/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            content: content,
            type: 'text'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        if (data.message) {
            throw new Error(data.message);
        }
        
        // 用服务器返回的真实消息替换临时消息
        replaceTempMessage(tempMessageId, data);
        
        // 清空输入框
        if (messageInput) messageInput.value = '';
        
        // 通过HTTP发送成功后，重新加载聊天记录以确保消息显示正确
        if (window.loadMessageHistory) {
            window.loadMessageHistory(currentRoomId);
        }
    })
    .catch(error => {
        console.error('发送消息失败:', error);
        window.showMessage('发送消息失败: ' + error.message, 'danger');
        
        // 移除临时消息
        removeTempMessage(tempMessageId);
    });
}

// 替换临时消息为真实消息
function replaceTempMessage(tempMessageId, realMessage) {
    console.log('替换临时消息:', tempMessageId, '为真实消息:', realMessage);
    
    // 从映射中移除
    tempMessageMap.delete(tempMessageId);
    
    // 查找临时消息元素
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessageId}"]`);
    if (!tempMessageElement) {
        console.warn('未找到临时消息元素:', tempMessageId);
        return;
    }
    
    // 渲染真实消息
    window.renderMessage(realMessage).then(renderedMessage => {
        const newElement = document.createElement('div');
        newElement.innerHTML = renderedMessage;
        const newMessageElement = newElement.firstElementChild;
        
        // 替换临时消息元素
        tempMessageElement.parentNode.replaceChild(newMessageElement, tempMessageElement);
        
        // 为新添加的解除限制按钮添加事件监听器
        const unlockButton = newMessageElement.querySelector('.unlock-code-btn');
        if (unlockButton) {
            // 先移除可能已存在的事件监听器
            const newUnlockButton = unlockButton.cloneNode(true);
            unlockButton.parentNode.replaceChild(newUnlockButton, unlockButton);
            
            newUnlockButton.addEventListener('click', async function() {
                const msgId = this.getAttribute('data-message-id');
                
                // 第一次确认
                const firstConfirm = confirm('注意：即将解除此消息的HTML限制，可能会执行其中的脚本代码。\n\n您确定要继续吗？');
                if (!firstConfirm) return;
                
                // 第二次确认
                const secondConfirm = confirm('警告：这是最后的确认！\n\n解除限制后，消息中的HTML和脚本将会被执行。\n\n是否确认解除限制？');
                if (!secondConfirm) return;
                
                // 添加到解除限制的消息集合
                if (window.unrestrictedMessages) {
                    window.unrestrictedMessages.add(msgId);
                }
                
                // 更新localStorage中的消息数据
                const allMessages = JSON.parse(localStorage.getItem('allMessages') || '[]');
                const updatedMessages = allMessages.map(msg => {
                    if (String(msg.messageId || msg.id || 'unknown') === msgId) {
                        // 更新消息对象，标记为已解除限制
                        return { ...msg, unrestricted: true };
                    }
                    return msg;
                });
                localStorage.setItem('allMessages', JSON.stringify(updatedMessages));
                
                // 重新渲染该消息（使用标记为unrestricted的消息对象）
                const msgElement = this.closest('.message-item');
                if (msgElement) {
                    // 查找对应的消息对象（使用标记为unrestricted的版本）
                    const message = updatedMessages.find(m => String(m.messageId || m.id || 'unknown') === msgId);
                    if (message) {
                        const renderMessageFunc = window.renderMessage || window.modules?.messageHandler?.renderMessage;
                        if (renderMessageFunc) {
                            msgElement.innerHTML = await renderMessageFunc({ ...message, unrestricted: true });
                        }
                        
                        // 为新渲染的消息再次绑定事件监听器
                        setTimeout(() => {
                            const newUnlockButton = msgElement.querySelector('.unlock-code-btn');
                            if (newUnlockButton) {
                                // 克隆节点以移除旧的事件监听器
                                const clonedButton = newUnlockButton.cloneNode(true);
                                newUnlockButton.parentNode.replaceChild(clonedButton, newUnlockButton);
                                
                                // 为克隆的按钮添加事件监听器
                                clonedButton.addEventListener('click', async function() {
                                    // 注意：这里不需要再次添加到unrestrictedMessages，因为它已经在上面添加过了
                                    const confirm1 = confirm('注意：即将解除此消息的HTML限制，可能会执行其中的脚本代码。\n\n您确定要继续吗？');
                                    if (!confirm1) return;
                                    
                                    const confirm2 = confirm('警告：这是最后的确认！\n\n解除限制后，消息中的HTML和脚本将会被执行。\n\n是否确认解除限制？');
                                    if (!confirm2) return;
                                    
                                    // 由于消息已经被标记为unrestricted，重新渲染即可
                                    const updatedMsgElement = this.closest('.message-item');
                                    if (updatedMsgElement) {
                                        if (renderMessageFunc) {
                                            updatedMsgElement.innerHTML = await renderMessageFunc({ ...message, unrestricted: true });
                                        }
                                    }
                                });
                            }
                        }, 0);
                    }
                }
            });
        }
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }).catch(error => {
        console.error('渲染真实消息失败:', error);
    });
}

// 移除临时消息
function removeTempMessage(tempMessageId) {
    // 从映射中移除
    tempMessageMap.delete(tempMessageId);
    
    // 查找并移除临时消息元素
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessageId}"]`);
    if (tempMessageElement) {
        tempMessageElement.remove();
    }
}

// 绑定发送消息事件
export function bindSendMessageEvents() {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            // Ctrl+Enter 或 Cmd+Enter 发送消息
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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