// 消息处理模块

// 用于跟踪已显示消息的集合，防止重复显示
const displayedMessages = new Set();

// 用户信息缓存
const userCache = new Map();
const userCacheExpiry = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 通过UID获取用户信息
export async function getUserInfoById(userId) {
    // 检查用户ID是否有效
    if (!userId || userId === 'undefined' || userId === 'null' || String(userId).trim() === '' || String(userId).trim() === 'undefined') {
        console.error('getUserInfoById: 无效的用户ID', userId);
        throw new Error('无效的用户ID');
    }
    
    // 转换为字符串并去除空格
    const userIdStr = String(userId).trim();
    
    // 检查缓存
    const now = Date.now();
    if (userCache.has(userIdStr)) {
        const expiry = userCacheExpiry.get(userIdStr);
        if (expiry && now < expiry) {
            return userCache.get(userIdStr);
        } else {
            // 缓存过期，清除
            userCache.delete(userIdStr);
            userCacheExpiry.delete(userIdStr);
        }
    }
    
    // 如果是当前用户，直接从localStorage获取
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (String(currentUser.id) === userIdStr) {
        return {
            id: currentUser.id,
            username: currentUser.username,
            nickname: currentUser.nickname || currentUser.username,
            avatarUrl: currentUser.avatarUrl || '/default-avatar.png'
        };
    }
    
    // 从服务器获取用户信息
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('未登录');
        }
        
        const response = await fetch(`/api/users/profile/${userIdStr}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const userData = await response.json();
        
        // 缓存用户信息
        userCache.set(userIdStr, userData);
        userCacheExpiry.set(userIdStr, now + CACHE_DURATION);
        
        return userData;
    } catch (error) {
        console.error('获取用户信息错误:', error);
        // 抛出错误让调用方处理
        throw error;
    }
}

// 渲染单条消息
export async function renderMessage(message) {
    // 格式化时间
    const messageTime = new Date(message.sentAt || message.createdAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // 获取发送者信息
    let senderInfo;
    try {
        // 优先使用消息中已有的用户信息
        if (message.User && typeof message.User === 'object') {
            senderInfo = {
                id: message.User.userId,
                username: message.User.username,
                nickname: message.User.nickname || message.User.username,
                avatarUrl: message.User.avatarUrl || '/default-avatar.png'
            };
        } else if (message.Sender && typeof message.Sender === 'object') {
            // 兼容旧的Sender字段
            senderInfo = {
                id: message.Sender.userId || message.Sender.id,
                username: message.Sender.username,
                nickname: message.Sender.nickname || message.Sender.username,
                avatarUrl: message.Sender.avatarUrl || '/default-avatar.png'
            };
        } else {
            // 如果没有现成的用户信息，则获取用户信息
            // 正确解析用户ID，考虑不同来源的数据结构
            let userId;
            if (message.User && typeof message.User === 'object') {
                userId = message.User.userId;
            } else if (message.Sender && typeof message.Sender === 'object') {
                // 从Sender对象中获取userId
                userId = message.Sender.userId || message.Sender.id;
            } else if (message.userId) {
                // 直接从message.userId获取
                userId = message.userId;
            }
            
            // 验证userId是否有效
            if (!userId || userId === 'undefined' || String(userId).trim() === '' || String(userId).trim() === 'undefined') {
                throw new Error('无法获取有效的发送者ID');
            }
            
            senderInfo = await getUserInfoById(userId);
        }
    } catch (error) {
        console.error('获取发送者信息失败:', error);
        // 使用消息对象中的信息作为备选
        senderInfo = {
            id: message.User?.userId || message.Sender?.userId || message.Sender?.id || message.userId || 'unknown',
            username: message.User?.username || message.Sender?.username || `用户${message.User?.userId || message.Sender?.userId || message.userId || '未知'}`,
            nickname: message.User?.nickname || message.Sender?.nickname || message.Sender?.username || `用户${message.User?.userId || message.Sender?.userId || message.userId || '未知'}`,
            avatarUrl: message.User?.avatarUrl || message.Sender?.avatarUrl || '/default-avatar.png'
        };
    }
    
    // 判断是否为当前用户发送的消息
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isCurrentUser = String(senderInfo.id) === String(currentUser.id);
    
    // 根据消息类型显示不同内容
    let content = '';
    switch (message.type) {
        case 'text':
            content = message.content || '';
            break;
        case 'image':
            // 改进图片URL处理逻辑 - 如果fileUrl为空则使用content字段
            let imageUrl = '';
            if (message.fileUrl) {
                imageUrl = message.fileUrl;
            } else if (message.dataValues && message.dataValues.fileUrl) {
                imageUrl = message.dataValues.fileUrl;
            } else if (message.data && message.data.fileUrl) {
                imageUrl = message.data.fileUrl;
            } else if (message.content) {
                // fallback到content字段
                imageUrl = message.content;
            }
            content = `<img src="${imageUrl}" alt="图片" class="message-image" style="max-width: 200px; max-height: 200px;">`;
            break;
        case 'video':
            // 改进视频URL处理逻辑 - 如果fileUrl为空则使用content字段
            let videoUrl = '';
            if (message.fileUrl) {
                videoUrl = message.fileUrl;
            } else if (message.dataValues && message.dataValues.fileUrl) {
                videoUrl = message.dataValues.fileUrl;
            } else if (message.data && message.data.fileUrl) {
                videoUrl = message.data.fileUrl;
            } else if (message.content) {
                // fallback到content字段
                videoUrl = message.content;
            }
            // 使用playVideoInFullscreen函数实现点击播放并自动全屏
            content = `
                <div style="position: relative; display: inline-block;" onclick="playVideoInFullscreen('${videoUrl}')">
                    <video src="${videoUrl}" class="message-video" style="max-width: 200px; max-height: 200px;"></video>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.7); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                        <i class="bi bi-play-fill" style="color: white; font-size: 20px;"></i>
                    </div>
                </div>
            `;
            break;
        case 'audio':
            // 处理音频URL - 如果fileUrl为空则使用content字段
            let audioUrl = '';
            let audioFileName = message.content || '音频文件';
            
            if (message.fileUrl) {
                audioUrl = message.fileUrl;
            } else if (message.dataValues && message.dataValues.fileUrl) {
                audioUrl = message.dataValues.fileUrl;
            } else if (message.data && message.data.fileUrl) {
                audioUrl = message.data.fileUrl;
            } else if (message.content) {
                // fallback到content字段
                audioUrl = message.content;
            }
            
            // 如果content字段包含URL路径，尝试从中提取文件名
            if (message.content && message.content.includes('/')) {
                const urlParts = message.content.split('/');
                if (urlParts.length > 0) {
                    audioFileName = urlParts[urlParts.length - 1];
                }
            }
            
            content = `
                <div class="message-audio">
                    <audio controls preload="metadata" style="width: 250px;">
                        <source src="${audioUrl}" type="${message.fileType || 'audio/mpeg'}">
                        您的浏览器不支持音频播放。<br>
                        <a href="${audioUrl}" target="_blank" download="${audioFileName}">点击下载音频</a>
                    </audio>
                    <div class="mt-1">
                        <a href="${audioUrl}" target="_blank" download="${audioFileName}">
                            <i class="bi bi-download"></i> ${audioFileName}
                        </a>
                    </div>
                </div>
            `;
            break;
        case 'file':
            // 改进文件URL处理逻辑 - 如果fileUrl为空则使用content字段
            let fileUrl = '';
            // 使用content作为默认文件名
            let fileName = message.content || '文件';
            
            // 尝试从各种可能的位置获取fileUrl
            if (message.fileUrl) {
                fileUrl = message.fileUrl;
            } else if (message.dataValues && message.dataValues.fileUrl) {
                fileUrl = message.dataValues.fileUrl;
            } else if (message.data && message.data.fileUrl) {
                fileUrl = message.data.fileUrl;
            } else if (message.content) {
                // fallback到content字段作为URL
                fileUrl = message.content;
            }
            
            // 如果content字段包含URL路径，尝试从中提取文件名
            if (message.content && message.content.includes('/')) {
                const urlParts = message.content.split('/');
                if (urlParts.length > 0) {
                    fileName = urlParts[urlParts.length - 1];
                }
            }
            
            content = `<a href="${fileUrl}" target="_blank" class="message-file">文件: ${fileName}</a>`;
            break;
        case 'recall':
            content = '<em>消息已被撤回</em>';
            break;
        default:
            content = message.content || '';
    }
    
    // 检查是否为待发送消息（临时消息）
    if (message.id && String(message.id).startsWith('temp_')) {
        content = `
            <div style="opacity: 0.7;">
                ${content}
                <div class="small text-muted mt-1">
                    <span class="spinner-border spinner-border-sm" role="status"></span>
                    发送中...
                </div>
            </div>
        `;
    }
    
    return `
        <div class="message ${isCurrentUser ? 'message-right' : 'message-left'}">
            <div class="message-bubble-container">
                <img src="${senderInfo.avatarUrl}" 
                     alt="头像" 
                     class="avatar" 
                     onerror="this.src='/default-avatar.png'">
                <div class="message-content">
                    <div class="message-sender">${senderInfo.nickname || senderInfo.username}</div>
                    <div class="message-bubble">
                        ${content}
                    </div>
                </div>
            </div>
            <div class="message-time">${messageTime}</div>
        </div>
    `;
}

// 显示消息
export async function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.warn('未找到消息显示区域');
        return;
    }
    
    // 如果只有一条消息，将其添加到现有消息列表中
    if (messages.length === 1) {
        const message = messages[0];
        const messageId = message.messageId || message.id;
        
        // 检查消息是否已显示过，防止重复显示
        if (displayedMessages.has(String(messageId))) {
            console.log('消息已显示过，跳过:', messageId);
            return;
        }
        
        // 将消息ID添加到已显示集合中
        displayedMessages.add(String(messageId));
        
        // 检查消息是否已存在
        const existingMessage = chatMessages.querySelector(`.message-item[data-message-id="${messageId}"]`);
        if (existingMessage) {
            // 如果消息已存在，更新内容（可能是撤回的消息）
            existingMessage.innerHTML = await renderMessage(message);
            return;
        }
        
        // 添加新消息
        const messageElement = document.createElement('div');
        messageElement.className = 'message-item mb-3';
        messageElement.setAttribute('data-message-id', messageId);
        messageElement.innerHTML = await renderMessage(message);
        chatMessages.appendChild(messageElement);
    } else {
        // 如果是多条消息（历史消息），替换整个消息列表
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>暂无消息</p></div>';
            return;
        }
        
        // 清空已显示消息集合，因为我们要重新加载历史消息
        displayedMessages.clear();
        
        // 将所有消息ID添加到已显示集合中
        messages.forEach(msg => {
            const messageId = msg.messageId || msg.id;
            displayedMessages.add(String(messageId));
        });
        
        // 使用 Promise.all 并行处理所有消息的渲染
        const renderedMessages = await Promise.all(messages.map(async (message) => {
            const rendered = await renderMessage(message);
            const messageId = message.messageId || message.id;
            return `
                <div class="message-item mb-3" data-message-id="${messageId}">
                    ${rendered}
                </div>
            `;
        }));
        
        chatMessages.innerHTML = renderedMessages.join('');
    }
    
    // 为图片添加点击事件以全屏查看
    const imageElements = chatMessages.querySelectorAll('.message-image');
    imageElements.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
            const fullScreenImage = document.getElementById('fullScreenImage');
            const imageModalEl = document.getElementById('imageModal');
            if (imageModalEl) {
                const imageModal = new bootstrap.Modal(imageModalEl);
                fullScreenImage.src = this.src;
                imageModal.show();
            }
        });
    });
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 清除消息记录（用于切换房间等场景）
export function clearDisplayedMessages() {
    displayedMessages.clear();
}