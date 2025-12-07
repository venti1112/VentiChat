// 文件上传模块
let currentUploadId = null;
let currentChunkXHR = null;

// 显示上传进度模态框
function showUploadProgress() {
    const modal = new bootstrap.Modal(document.getElementById('uploadProgressModal'));
    modal.show();
    
    // 重置进度条和相关信息
    updateProgress(0);
    updateUploadedSize(0);
    updateUploadSpeed(0);
    updateFileName('');
}

// 更新进度条
function updateProgress(percent) {
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressBar && progressText) {
        progressBar.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', percent);
        progressText.textContent = percent + '%';
    }
}

// 更新已上传大小显示
function updateUploadedSize(loadedBytes, totalBytes) {
    const uploadedSizeText = document.getElementById('uploadedSizeText');
    const fileSizeText = document.getElementById('fileSizeText');
    
    if (uploadedSizeText) {
        uploadedSizeText.textContent = formatFileSize(loadedBytes);
    }
    
    if (fileSizeText && totalBytes) {
        fileSizeText.textContent = formatFileSize(totalBytes);
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

// 更新文件名显示
function updateFileName(name) {
    const nameElement = document.getElementById('uploadingFileName');
    if (nameElement) {
        nameElement.textContent = name;
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

// 分片上传
async function uploadFile(file) {
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
    if (progressModalElement) {
        const progressModal = new bootstrap.Modal(progressModalElement, {
            backdrop: 'static',
            keyboard: false
        });
        progressModal.show();
    }
    
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
                roomId: roomId,
                purpose: purpose  // 添加purpose字段
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
            chunkFormData.append('roomId', roomId);
            chunkFormData.append('purpose', purpose); // 添加purpose字段
            
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
                        
                        // 调用外部进度回调
                        if (onProgress) {
                            onProgress(overallProgress, uploadedBytes, speed);
                        }
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
        
        // 3. 完成分片上传
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
        
        // 隐藏进度模态框
        const modalEl = document.getElementById('uploadProgressModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
                modal.hide();
            }
        }
        
        return finalizeData;
    } catch (error) {
        // 隐藏进度模态框
        const modalEl = document.getElementById('uploadProgressModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
                modal.hide();
            }
        }
        
        // 清理服务器上的临时文件
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
        
        throw error;
    }
}


// 发送文件消息
function sendFileMessage(fileUrl, fileName, fileType, thumbnailUrl = null) {
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
    } else if (fileType.startsWith('audio/')) {
        messageType = 'audio';
    }
    
    // 确保fileUrl以/api开头
    let correctedFileUrl = fileUrl;
    if (fileUrl.startsWith('/userdata/')) {
        correctedFileUrl = fileUrl.replace('/userdata/', '/api/userdata/');
    }
    
    // 构建消息数据
    const messageData = {
        roomId: parseInt(currentRoomId),
        content: fileName,
        fileUrl: correctedFileUrl,
        type: messageType
    };
    
    // 如果有缩略图URL，添加到消息数据中
    if (thumbnailUrl) {
        messageData.thumbnailUrl = thumbnailUrl;
    }
    
    // 发送文件消息到服务器
    fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
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

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 显示文件名和文件大小
    document.getElementById('uploadFileName').textContent = file.name;
    currentFileSize = file.size;
    if (document.getElementById('fileSizeText')) {
        document.getElementById('fileSizeText').textContent = formatFileSize(file.size);
    }
    
    // 所有文件都使用分片上传
    uploadFile(file);
    
    // 清空文件输入框，防止重复选择相同文件时不触发change事件
    event.target.value = '';
}

// 绑定文件上传事件
function bindFileUploadEvents() {
    // 监听文件选择事件
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // 监听拖拽上传事件
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        // 阻止默认的拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, preventDefaults, false);
        });
        
        // 高亮拖拽区域
        ['dragenter', 'dragover'].forEach(eventName => {
            chatContainer.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, unhighlight, false);
        });
        
        // 处理文件 drop 事件
        chatContainer.addEventListener('drop', handleDrop, false);
    }
}

// 阻止默认的拖拽行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 高亮拖拽区域
function highlight() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.add('drag-over');
    }
}

// 取消高亮拖拽区域
function unhighlight() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.remove('drag-over');
    }
}

// 处理文件 drop 事件
function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    
    if (file) {
        uploadFile(file);
    }
}

// 导出函数
export {
    handleFileSelect,
    uploadFile,
    sendFileMessage,
    bindFileUploadEvents
};