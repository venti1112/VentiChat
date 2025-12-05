// 文件上传模块

// 用于存储当前的XMLHttpRequest对象，以便可以取消请求
let currentXHR = null;
let currentUploadId = null;
let currentFileSize = 0; // 用于存储当前文件大小

// 处理文件选择
export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 显示文件名和文件大小
    document.getElementById('uploadFileName').textContent = file.name;
    currentFileSize = file.size;
    document.getElementById('fileSizeText').textContent = formatFileSize(file.size);
    
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
    
    // 显示进度条模态框，设置 backdrop 为 static 防止点击外部关闭
    const progressModalElement = document.getElementById('uploadProgressModal');
    const progressModal = new bootstrap.Modal(progressModalElement, {
        backdrop: 'static',
        keyboard: false
    });
    progressModal.show();
    
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
    
    const xhr = new XMLHttpRequest();
    currentXHR = xhr; // 保存当前请求的引用
    
    // 绑定取消按钮事件
    const cancelBtn = document.getElementById('cancelUploadBtn');
    if (cancelBtn) {
        // 清除之前的事件监听器
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', () => {
            if (currentXHR) {
                currentXHR.abort();
                currentXHR = null;
            }
        });
    }
    
    // 初始化上传速度计算变量
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    
    // 监听上传进度
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            updateProgress(percentComplete);
            
            // 更新已上传大小显示
            updateUploadedSize(e.loaded);
            
            // 计算上传速度
            const currentTime = Date.now();
            const elapsedTime = (currentTime - lastTime) / 1000; // 转换为秒
            const loadedDiff = e.loaded - lastLoaded;
            
            if (elapsedTime > 0) {
                const speed = loadedDiff / elapsedTime; // bytes per second
                updateUploadSpeed(speed);
            }
            
            // 更新变量
            lastLoaded = e.loaded;
            lastTime = currentTime;
        }
    });
    
    // 处理上传完成
    xhr.addEventListener('load', () => {
        currentXHR = null; // 清除引用
        
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            // 文件上传成功，创建文件消息
            sendFileMessage(data.fileUrl, file.name, file.type);
            // 隐藏进度条模态框
            bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
        } else {
            try {
                const errorData = JSON.parse(xhr.responseText);
                throw new Error(errorData.error || '上传失败');
            } catch (e) {
                throw new Error('上传失败');
            }
        }
    });
    
    // 处理上传错误
    xhr.addEventListener('error', () => {
        currentXHR = null; // 清除引用
        window.showMessage('文件上传失败: 网络错误', 'danger');
        bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
    });
    
    // 处理用户取消上传
    xhr.addEventListener('abort', () => {
        currentXHR = null; // 清除引用
        window.showMessage('文件上传已取消', 'info');
        bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
    });
    
    // 发送请求
    xhr.open('POST', uploadEndpoint, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
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
    
    // 显示进度条模态框，设置 backdrop 为 static 防止点击外部关闭
    const progressModalElement = document.getElementById('uploadProgressModal');
    const progressModal = new bootstrap.Modal(progressModalElement, {
        backdrop: 'static',
        keyboard: false
    });
    progressModal.show();
    
    // 初始化上传速度计算变量
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    let totalLoaded = 0;
    const fileSize = file.size;
    
    // 用于存储当前分片的请求，以便可以取消
    let currentChunkXHR = null;
    let uploadId = null;
    
    // 绑定取消按钮事件
    const cancelBtn = document.getElementById('cancelUploadBtn');
    if (cancelBtn) {
        // 清除之前的事件监听器
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', async () => {
            // 取消当前请求
            if (currentChunkXHR) {
                currentChunkXHR.abort();
                currentChunkXHR = null;
            }
            
            // 如果已有uploadId，通知后端清理
            if (uploadId) {
                try {
                    await fetch('/api/upload/cleanup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ uploadId })
                    });
                } catch (e) {
                    console.error('清理上传文件失败:', e);
                }
            }
            
            window.showMessage('文件上传已取消', 'info');
            bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
        });
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
        uploadId = initData.uploadId; // 保存uploadId用于可能的清理操作
        currentUploadId = uploadId;
        
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
            chunkFormData.append('roomId', currentRoomId);
            
            // 创建新的XHR以便监听每个分片的进度
            const xhr = new XMLHttpRequest();
            currentChunkXHR = xhr; // 保存当前请求的引用
            
            // 创建Promise来等待这个分片上传完成
            const chunkPromise = new Promise((resolve, reject) => {
                // 监听上传进度
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        // 计算整体进度
                        const chunkProgress = (e.loaded / e.total);
                        const overallProgress = Math.round(((i + chunkProgress) / totalChunks) * 100);
                        updateProgress(overallProgress);
                        
                        // 更新已上传大小显示
                        const uploadedBytes = i * chunkSize + e.loaded;
                        updateUploadedSize(uploadedBytes);
                        
                        // 计算上传速度
                        const currentTime = Date.now();
                        const elapsedTime = (currentTime - lastTime) / 1000; // 转换为秒
                        const loadedDiff = e.loaded - lastLoaded;
                        
                        if (elapsedTime > 0) {
                            const speed = loadedDiff / elapsedTime; // bytes per second
                            updateUploadSpeed(speed);
                        }
                        
                        // 更新变量
                        lastLoaded = e.loaded;
                        lastTime = currentTime;
                        totalLoaded = i * chunkSize + e.loaded;
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        resolve();
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            reject(new Error(errorData.error || `上传分片 ${i + 1} 失败`));
                        } catch (e) {
                            reject(new Error(`上传分片 ${i + 1} 失败`));
                        }
                    }
                });
                
                xhr.addEventListener('error', () => {
                    reject(new Error(`上传分片 ${i + 1} 网络错误`));
                });
                
                xhr.addEventListener('abort', () => {
                    reject(new Error(`上传分片 ${i + 1} 已取消`));
                });
                
                // 发送请求
                xhr.open('POST', '/api/upload/chunk', true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(chunkFormData);
            });
            
            // 等待这个分片上传完成
            await chunkPromise;
        }
        
        // 3. 完成上传
        const finalizeResponse = await fetch('/api/upload/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                uploadId: uploadId,
                fileName: file.name,
                fileSize: file.size,
                roomId: currentRoomId
            })
        });
        
        if (!finalizeResponse.ok) {
            const errorData = await finalizeResponse.json();
            throw new Error(errorData.error || '完成上传失败');
        }
        
        const finalizeData = await finalizeResponse.json();
        
        // 文件上传成功，创建文件消息
        sendFileMessage(finalizeData.fileUrl, file.name, file.type);
        
        // 隐藏进度条模态框
        bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
        
        window.showMessage('文件上传成功', 'success');
    } catch (error) {
        console.error('文件上传失败:', error);
        window.showMessage('文件上传失败: ' + error.message, 'danger');
        
        // 隐藏进度条模态框
        bootstrap.Modal.getInstance(document.getElementById('uploadProgressModal')).hide();
        
        // 如果已有uploadId，通知后端清理
        if (uploadId) {
            try {
                await fetch('/api/upload/cleanup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ uploadId })
                });
            } catch (e) {
                console.error('清理上传文件失败:', e);
            }
        }
    }
}

// 更新进度条显示
function updateProgress(percent) {
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', percent);
    }
    
    if (progressText) {
        progressText.textContent = percent + '%';
    }
}

// 更新已上传大小显示
function updateUploadedSize(loadedBytes) {
    const uploadedSizeText = document.getElementById('uploadedSizeText');
    if (uploadedSizeText) {
        uploadedSizeText.textContent = formatFileSize(loadedBytes) + ' / ';
    }
}

// 更新上传速度显示
function updateUploadSpeed(bytesPerSecond) {
    const uploadSpeedText = document.getElementById('uploadSpeedText');
    if (!uploadSpeedText) return;
    
    // 转换为更友好的单位
    if (bytesPerSecond >= 1024 * 1024) {
        // MB/s
        const speedInMBs = (bytesPerSecond / (1024 * 1024)).toFixed(2);
        uploadSpeedText.textContent = speedInMBs + ' MB/s';
    } else if (bytesPerSecond >= 1024) {
        // KB/s
        const speedInKBs = (bytesPerSecond / 1024).toFixed(2);
        uploadSpeedText.textContent = speedInKBs + ' KB/s';
    } else {
        // B/s
        uploadSpeedText.textContent = bytesPerSecond.toFixed(2) + ' B/s';
    }
}

// 格式化文件大小显示
function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    } else if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else if (bytes >= 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    } else {
        return bytes + ' B';
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

// 绑定文件上传事件
export function bindFileUploadEvents() {
    // 文件上传按钮事件
    const attachFileBtn = document.getElementById('attachFileBtn');
    if (attachFileBtn) {
        attachFileBtn.addEventListener('click', function() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.onchange = handleFileSelect;
            fileInput.click();
        });
    }
}