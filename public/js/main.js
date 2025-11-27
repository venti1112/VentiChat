// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileForm } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, uploadLargeFile, sendFileMessage } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';

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
window.initializeWebSocket = initializeWebSocket;
window.updateUnreadCount = updateUnreadCount;
window.updateRoomUnreadCount = updateRoomUnreadCount;
window.handleFileSelect = handleFileSelect;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    checkLoginStatus();
    
    // 绑定个人资料表单
    bindProfileForm();
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 加载聊天室列表
    function loadRooms() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('未登录，无法加载聊天室列表');
            return;
        }
        
        fetch('/api/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('加载聊天室列表失败');
            }
            return response.json();
        })
        .then(rooms => {
            displayRooms(rooms);
        })
        .catch(error => {
            console.error('加载聊天室列表错误:', error);
            showMessage('加载聊天室列表失败: ' + error.message, 'danger');
        });
    }
    
    // 将loadRooms函数暴露到全局作用域
    window.loadRooms = loadRooms;
    
    // 页面加载完成后加载聊天室列表
    const chatSection = document.getElementById('chatSection');
    if (chatSection && chatSection.style.display !== 'none') {
        // 如果聊天界面已显示，则加载聊天室列表
        loadRooms();
    }
    
    // 绑定聊天室相关按钮事件
    bindRoomButtons();
});

// 绑定聊天室相关按钮事件
function bindRoomButtons() {
    // 创建聊天室按钮
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', function() {
            const createRoomModal = new bootstrap.Modal(document.getElementById('createRoomModal'));
            if (createRoomModal) {
                createRoomModal.show();
            }
        });
    }
    
    // 搜索聊天室按钮
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) {
        searchRoomBtn.addEventListener('click', function() {
            const searchRoomModal = new bootstrap.Modal(document.getElementById('searchRoomModal'));
            if (searchRoomModal) {
                searchRoomModal.show();
            }
        });
    }
    
    // 搜索聊天室按钮事件
    const searchRoomButton = document.getElementById('searchRoomButton');
    if (searchRoomButton) {
        searchRoomButton.addEventListener('click', function() {
            const searchInput = document.getElementById('searchRoomInput');
            if (searchInput) {
                searchRooms(searchInput.value);
            }
        });
    }
    
    // 成员按钮
    const membersBtn = document.getElementById('membersBtn');
    if (membersBtn) {
        membersBtn.addEventListener('click', function() {
            // 获取当前聊天室的成员列表
            loadRoomMembers();
            
            const membersModal = new bootstrap.Modal(document.getElementById('membersModal'));
            if (membersModal) {
                membersModal.show();
            }
        });
    }
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
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

            fetch(`/api/rooms/${currentRoomId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('获取聊天室信息失败');
                }
                return response.json();
            })
            .then(room => {
                // 填充表单数据
                document.getElementById('roomNameSetting').value = room.name;
                document.getElementById('requireApprovalSetting').checked = room.requireApproval;
                document.getElementById('allowImagesSetting').checked = room.allowImages;
                document.getElementById('allowVideosSetting').checked = room.allowVideos;
                document.getElementById('allowFilesSetting').checked = room.allowFiles;
                
                // 显示模态框
                const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
                if (settingsModal) {
                    settingsModal.show();
                }
            })
            .catch(error => {
                console.error('获取聊天室信息失败:', error);
                showMessage('获取聊天室信息失败: ' + error.message, 'danger');
            });
        });
    }
    
    // 绑定创建聊天室表单提交事件
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(createRoomForm);
            const roomData = {
                name: formData.get('name'),
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on'
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
                showMessage('未登录，请先登录', 'danger');
                return;
            }
            
            fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(roomData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '创建聊天室失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                showMessage('聊天室创建成功', 'success');
                // 隐藏模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('createRoomModal'));
                if (modal) {
                    modal.hide();
                }
                // 重新加载聊天室列表
                if (typeof window.loadRooms === 'function') {
                    window.loadRooms();
                }
            })
            .catch(error => {
                console.error('创建聊天室失败:', error);
                showMessage(error.message || '创建聊天室失败', 'danger');
            });
        });
    }
    
    // 绑定聊天室设置表单提交事件
    const roomSettingsForm = document.getElementById('roomSettingsForm');
    if (roomSettingsForm) {
        roomSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (!currentRoomId) {
                showMessage('请先选择一个聊天室', 'warning');
                return;
            }
            
            const formData = new FormData(roomSettingsForm);
            const roomData = {
                name: formData.get('name'),
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on'
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
                showMessage('未登录，请先登录', 'danger');
                return;
            }
            
            fetch(`/api/rooms/${currentRoomId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(roomData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '更新聊天室设置失败');
                    });
                }
                return response.json();
            })
            .then(room => {
                showMessage('聊天室设置已更新', 'success');
                // 隐藏模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                if (modal) {
                    modal.hide();
                }
                // 更新当前聊天室名称显示
                const currentRoomNameElement = document.getElementById('currentRoomName');
                if (currentRoomNameElement) {
                    currentRoomNameElement.textContent = room.name;
                }
                // 重新加载聊天室列表
                if (typeof window.loadRooms === 'function') {
                    window.loadRooms();
                }
            })
            .catch(error => {
                console.error('更新聊天室设置失败:', error);
                showMessage(error.message || '更新聊天室设置失败', 'danger');
            });
        });
    }
}

// 加载聊天室成员列表
function loadRoomMembers() {
    // 获取当前聊天室RID
    const currentRoomId = localStorage.getItem('currentRoomId');
    // 检查roomId的有效性
    if (!currentRoomId || currentRoomId === 'undefined' || currentRoomId === 'null') {
        showMessage('请先选择一个聊天室', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/${currentRoomId}/members`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('获取成员列表失败');
        }
        return response.json();
    })
    .then(members => {
        displayRoomMembers(members);
    })
    .catch(error => {
        console.error('获取聊天室成员列表错误:', error);
        showMessage('获取成员列表失败: ' + error.message, 'danger');
    });
}

// 显示聊天室成员列表
function displayRoomMembers(members) {
    const membersList = document.getElementById('membersList');
    if (!membersList) {
        console.warn('未找到成员列表容器');
        return;
    }
    
    if (!members || members.length === 0) {
        membersList.innerHTML = '<li class="list-group-item text-center text-muted">暂无成员</li>';
        return;
    }
    
    membersList.innerHTML = members.map(member => `
        <li class="list-group-item d-flex align-items-center">
            <img src="${member.avatarUrl || '/default-avatar.png'}" 
                 alt="头像" 
                 class="rounded-circle me-3" 
                 width="40" 
                 height="40"
                 onerror="this.src='/default-avatar.png'">
            <div class="flex-grow-1">
                <div class="fw-bold">${member.nickname || member.username}</div>
                <div class="text-muted small">@${member.username}</div>
                <div class="text-muted small">UID: ${member.uid || member.id}</div>
            </div>
            ${member.isCreator ? '<span class="badge bg-success">群主</span>' : ''}
            ${member.isModerator ? '<span class="badge bg-warning">管理员</span>' : ''}
        </li>
    `).join('');
}

// 搜索聊天室功能
function searchRooms(query) {
    if (!query) {
        showMessage('请输入搜索关键词', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/search?q=${encodeURIComponent(query)}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('搜索失败');
        }
        return response.json();
    })
    .then(data => {
        displaySearchResults(data.rooms);
    })
    .catch(error => {
        console.error('搜索聊天室失败:', error);
        showMessage('搜索失败，请稍后再试', 'danger');
    });
}

// 显示搜索结果
function displaySearchResults(rooms) {
    const resultsContainer = document.getElementById('searchRoomResults');
    if (!resultsContainer) return;
    
    if (!rooms || rooms.length === 0) {
        resultsContainer.innerHTML = '<li class="list-group-item">未找到相关聊天室</li>';
        return;
    }
    
    resultsContainer.innerHTML = rooms.map(room => `
        <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${room.name}</h6>
                    <small class="text-muted">ID: ${room.id} | 创建者: ${room.creatorNickname} | 成员: ${room.memberCount}人</small>
                </div>
                <button class="btn btn-sm btn-outline-primary" onclick="joinRoom(${room.id})">
                    加入
                </button>
            </div>
        </li>
    `).join('');
}

// 加入房间功能
function joinRoom(roomId) {
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('未登录，请先登录', 'danger');
        return;
    }
    
    fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '加入聊天室失败');
            });
        }
        return response.json();
    })
    .then(result => {
        showMessage('成功加入聊天室', 'success');
        // 重新加载聊天室列表
        if (typeof window.loadRooms === 'function') {
            window.loadRooms();
        }
        // 隐藏搜索模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('searchRoomModal'));
        if (modal) {
            modal.hide();
        }
    })
    .catch(error => {
        console.error('加入聊天室失败:', error);
        showMessage(error.message || '加入聊天室失败', 'danger');
    });
}

// 将函数暴露到全局作用域
window.joinRoom = joinRoom;