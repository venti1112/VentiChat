// 文件上传模块

// 处理文件选择
export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件大小（大于25MB需要分片上传）
    if (file.size > 25 * 1024 * 1024) {
        uploadLargeFile(file);
    } else {
        uploadFile(file);
    }
}

// 上传普通文件
export function uploadFile(file) {
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
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', currentRoomId);
    
    // 根据文件类型确定上传端点
    let uploadEndpoint = '/api/messages/file';
    if (file.type.startsWith('image/')) {
        uploadEndpoint = '/api/messages/image';
    } else if (file.type.startsWith('video/')) {
        uploadEndpoint = '/api/messages/video';
    }
    
    fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '上传失败');
            });
        }
        return response.json();
    })
    .then(data => {
        // 文件上传成功，创建文件消息
        sendFileMessage(data.fileUrl, file.name, file.type);
    })
    .catch(error => {
        console.error('文件上传失败:', error);
        window.showMessage('文件上传失败: ' + error.message, 'danger');
    });
}

// 上传大文件（分片上传）
export async function uploadLargeFile(file) {
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
    
    try {
        // 1. 初始化分片上传
        const initResponse = await fetch('/api/upload/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fileName: file.name,
                fileSize: file.size,
                roomId: currentRoomId
            })
        });
        
        if (!initResponse.ok) {
            const errorData = await initResponse.json();
            throw new Error(errorData.error || '初始化上传失败');
        }
        
        const initData = await initResponse.json();
        const { uploadId } = initData;
        
        // 2. 分片上传文件
        const chunkSize = 25 * 1024 * 1024; // 25MB per chunk
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            const chunkFormData = new FormData();
            chunkFormData.append('chunk', chunk);
            chunkFormData.append('uploadId', uploadId);
            chunkFormData.append('chunkIndex', i);
            chunkFormData.append('totalChunks', totalChunks);
            
            const chunkResponse = await fetch('/api/upload/chunk', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: chunkFormData
            });
            
            if (!chunkResponse.ok) {
                const errorData = await chunkResponse.json();
                throw new Error(errorData.error || `上传分片 ${i + 1} 失败`);
            }
            
            // 更新进度显示
            const progress = Math.round(((i + 1) / totalChunks) * 100);
            window.showMessage(`上传进度: ${progress}% (${i + 1}/${totalChunks})`, 'info');
        }
        
        // 3. 完成分片上传
        const completeResponse = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uploadId: uploadId,
                fileName: file.name,
                fileType: file.type,
                roomId: currentRoomId
            })
        });
        
        if (!completeResponse.ok) {
            const errorData = await completeResponse.json();
            throw new Error(errorData.error || '完成上传失败');
        }
        
        const completeData = await completeResponse.json();
        
        // 文件上传成功，创建文件消息
        sendFileMessage(completeData.fileUrl, file.name, file.type);
    } catch (error) {
        console.error('分片上传失败:', error);
        window.showMessage('文件上传失败: ' + error.message, 'danger');
    }
}

// 发送文件消息
export function sendFileMessage(fileUrl, fileName, fileType) {
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
    
    // 确定消息类型
    let messageType = 'file';
    if (fileType.startsWith('image/')) {
        messageType = 'image';
    } else if (fileType.startsWith('video/')) {
        messageType = 'video';
    }
    
    // 发送文件消息到服务器
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            roomId: parseInt(currentRoomId),
            content: fileName,
            fileUrl: fileUrl,  // 添加fileUrl字段
            type: messageType
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '发送文件消息失败');
            });
        }
        return response.json();
    })
    .then(data => {
        // 清空输入框
        const messageInput = document.getElementById('messageInput');
        if (messageInput) messageInput.value = '';
    })
    .catch(error => {
        console.error('发送文件消息失败:', error);
        window.showMessage('发送文件消息失败: ' + error.message, 'danger');
    });
}