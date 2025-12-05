// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileForm } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory, loadRooms, bindRoomButtons, joinRoom } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, uploadLargeFile, sendFileMessage } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';
import { playVideoInFullscreen } from './modules/videoPlayer.js';
import { imageViewerInstance } from './modules/imageViewer.js';

// 将函数暴露到全局作用域，以便HTML可以直接调用
window.showMessage = showMessage;
window.showConfirm = showConfirm;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.openProfilePopup = openProfilePopup;
window.closeProfilePopup = closeProfilePopup;
window.updateProfile = updateProfile;
window.applyUserPreferences = applyUserPreferences;
window.displayMessages = displayMessages;
window.renderMessage = renderMessage;
window.getUserInfoById = getUserInfoById;
window.displayRooms = displayRooms;
window.enterRoom = enterRoom;
window.loadMessageHistory = loadMessageHistory;
window.loadRooms = loadRooms;
window.joinRoom = joinRoom;
window.initializeWebSocket = initializeWebSocket;
window.updateUnreadCount = updateUnreadCount;
window.updateRoomUnreadCount = updateRoomUnreadCount;
window.handleFileSelect = handleFileSelect;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;
window.playVideoInFullscreen = playVideoInFullscreen;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 隐藏加载动画
    const loadingElement = document.getElementById('initialLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }

    // 检查登录状态
    checkLoginStatus();
    
    // 如果已经登录，初始化WebSocket连接
    const token = localStorage.getItem('token');
    const chatSection = document.getElementById('chatSection');
    if (token && chatSection && chatSection.style.display !== 'none') {
        // 初始化WebSocket连接
        initializeWebSocket(token);
    }
    
    // 绑定个人资料表单
    bindProfileForm();
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 页面加载完成后加载聊天室列表
    if (chatSection && chatSection.style.display !== 'none') {
        // 如果聊天界面已显示，则加载聊天室列表
        loadRooms();
    }
    
    // 绑定聊天室相关按钮事件
    bindRoomButtons();
});

    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async function() {
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (!currentRoomId) {
                showMessage('请先选择一个聊天室', 'warning');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                showMessage('未登录，请先登录', 'danger');
                return;
            }

            try {
                const response = await fetch(`/api/rooms/${currentRoomId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('获取聊天室信息失败');
                }

                const room = await response.json();

                // 填充表单数据
                document.getElementById('roomNameSetting').value = room.name;
                document.getElementById('requireApprovalSetting').checked = room.requireApproval;
                document.getElementById('allowImagesSetting').checked = room.allowImages;
                document.getElementById('allowVideosSetting').checked = room.allowVideos;
                document.getElementById('allowFilesSetting').checked = room.allowFiles;

                // 显示设置模态框
                const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
                if (settingsModal) {
                    settingsModal.show();
                    
                    // 如果是房主，加载待处理请求
                    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                    if (room.creatorId === currentUser.userId) {
                        await loadPendingRequests(currentRoomId, token);
                        // 确保审批区域可见
                        const joinRequestsSection = document.getElementById('joinRequestsSection');
                        if (joinRequestsSection) {
                            joinRequestsSection.style.display = 'block';
                        }
                    } else {
                        // 隐藏审批区域
                        const joinRequestsSection = document.getElementById('joinRequestsSection');
                        if (joinRequestsSection) {
                            joinRequestsSection.style.display = 'none';
                        }
                    }
                }
            } catch (error) {
                console.error('获取聊天室设置错误:', error);
                showMessage('获取聊天室设置失败: ' + error.message, 'danger');
            }
        });
    }

    // 加载待审批请求
    async function loadPendingRequests(roomId, token) {
        try {
            const response = await fetch(`/api/rooms/${roomId}/pending-requests`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('获取待处理请求失败');
            }

            const requests = await response.json();
            displayPendingRequests(requests);
        } catch (error) {
            console.error('加载待审批请求失败:', error);
            showMessage('加载待审批请求失败: ' + error.message, 'danger');
        }
    }

    // 显示待审批请求
    function displayPendingRequests(requests) {
        const container = document.getElementById('pendingRequestsContainer');
        const noRequestsMessage = document.getElementById('noRequestsMessage');
        const joinRequestsSection = document.getElementById('joinRequestsSection');
        
        if (!container) return;

        // 如果没有请求，显示"暂无请求"消息
        if (!requests || requests.length === 0) {
            if (noRequestsMessage) {
                noRequestsMessage.style.display = 'block';
            }
            container.innerHTML = '';
            if (joinRequestsSection) {
                joinRequestsSection.style.display = 'block';
            }
            return;
        }

        // 隐藏"暂无请求"消息
        if (noRequestsMessage) {
            noRequestsMessage.style.display = 'none';
        }

        let html = '';
        requests.forEach(request => {
            // 获取用户信息
            const user = request.User || {};
            
            html += `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center">
                                <img src="${user.avatarUrl || '/default-avatar.png'}" 
                                     alt="头像" 
                                     class="rounded-circle me-3" 
                                     width="40" 
                                     height="40"
                                     onerror="this.src='/default-avatar.png'">
                                <div>
                                    <h6 class="mb-1">${user.nickname || user.username || '未知用户'}</h6>
                                    <p class="mb-1 text-muted small">@${user.username || 'unknown'}</p>
                                    ${request.message ? `<p class="mb-1">${request.message}</p>` : ''}
                                    <small class="text-muted">申请时间: ${new Date(request.requestTime).toLocaleString('zh-CN')}</small>
                                </div>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-success approve-request-btn me-1" 
                                        data-user-id="${user.userId}"
                                        data-room-id="${request.roomId}">
                                    <i class="bi bi-check"></i> 允许
                                </button>
                                <button class="btn btn-sm btn-danger reject-request-btn" 
                                        data-user-id="${user.userId}"
                                        data-room-id="${request.roomId}">
                                    <i class="bi bi-x"></i> 拒绝
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        
        // 显示审批区域
        if (joinRequestsSection) {
            joinRequestsSection.style.display = 'block';
        }

        // 绑定批准和拒绝按钮事件
        document.querySelectorAll('.approve-request-btn').forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                const roomId = this.getAttribute('data-room-id');
                handleJoinRequest(roomId, userId, 'approve');
            });
        });

        document.querySelectorAll('.reject-request-btn').forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                const roomId = this.getAttribute('data-room-id');
                handleJoinRequest(roomId, userId, 'reject');
            });
        });
    }

    // 处理加入请求（批准或拒绝）
    async function handleJoinRequest(roomId, userId, action) {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('未登录', 'danger');
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomId}/approve-join-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: parseInt(userId),
                    action: action
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // 显示成功消息
            showMessage(action === 'approve' ? '已允许用户加入' : '已拒绝用户加入请求', 'success');

            // 重新加载待处理请求
            await loadPendingRequests(roomId, token);
        } catch (error) {
            console.error('处理加入请求失败:', error);
            showMessage('处理失败: ' + error.message, 'danger');
        }
    }
