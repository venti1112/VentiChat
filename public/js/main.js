// 显示全局消息
function showMessage(message, type = 'success') {
    const messageModal = document.getElementById('messageModal');
    const messageOverlay = document.getElementById('messageOverlay');
    const messageContent = document.getElementById('messageContent');
    const messageOK = document.getElementById('messageOK');
    const messageTitle = document.getElementById('messageTitle');
    
    if (messageModal && messageOverlay && messageContent) {
        // 设置消息内容和标题
        messageContent.textContent = message;
        messageTitle.textContent = type === 'success' ? '成功' : type === 'danger' ? '错误' : '提示';
        
        // 显示模态框和遮罩
        messageOverlay.style.display = 'flex';
        
        // 绑定确定按钮事件
        messageOK.onclick = function() {
            messageOverlay.style.display = 'none';
        };
    }
}

// 自定义确认框函数
function showConfirm(message) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirmModal');
        const confirmOverlay = document.getElementById('confirmOverlay');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmOK = document.getElementById('confirmOK');
        const confirmCancel = document.getElementById('confirmCancel');
        
        if (confirmModal && confirmOverlay && confirmMessage) {
            // 设置确认消息
            confirmMessage.textContent = message;
            
            // 显示模态框和遮罩
            confirmOverlay.style.display = 'flex';
            
            // 确定按钮事件
            confirmOK.onclick = function() {
                confirmOverlay.style.display = 'none';
                resolve(true);
            };
            
            // 取消按钮事件
            confirmCancel.onclick = function() {
                confirmOverlay.style.display = 'none';
                resolve(false);
            };
        } else {
            // 如果模态框不存在，使用默认的confirm
            resolve(confirm(message));
        }
    });
}

// 切换到注册表单
function showRegisterForm() {
    const loginContainer = document.getElementById('loginContainer');
    const registerContainer = document.getElementById('registerContainer');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'block';
}

// 切换到登录表单
function showLoginForm() {
    const registerContainer = document.getElementById('registerContainer');
    const loginContainer = document.getElementById('loginContainer');
    
    if (registerContainer) registerContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'block';
}

// 打开个人中心弹窗
function openProfilePopup() {
    const profilePopup = document.getElementById('profilePopup');
    const overlay = document.getElementById('overlay');
    
    if (profilePopup) profilePopup.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // 同步用户信息到弹窗
    const userNickname = document.getElementById('userNickname');
    const userUsername = document.getElementById('userUsername');
    const popupNickname = document.getElementById('popupNickname');
    const popupUsername = document.getElementById('popupUsername');
    const popupUid = document.getElementById('popupUid');
    const currentAvatar = document.getElementById('currentAvatar');
    const userAvatar = document.getElementById('userAvatar');
    
    if (popupNickname && userNickname) popupNickname.value = userNickname.textContent;
    if (popupUsername && userUsername) popupUsername.value = userUsername.textContent;
    if (popupUid) popupUid.value = localStorage.getItem('userId');
    if (currentAvatar && userAvatar) currentAvatar.src = userAvatar.src;
}

// 关闭个人中心弹窗
function closeProfilePopup() {
    const profilePopup = document.getElementById('profilePopup');
    const overlay = document.getElementById('overlay');
    
    if (profilePopup) profilePopup.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

// 引入前端日志工具
// 使用统一的前端日志工具
const logger = window.logger || {
    logInfo: () => {},
    logWarn: () => {},
    logError: () => {}
};

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    logger.logInfo('页面加载完成，检查登录状态');
    const token = localStorage.getItem('token');
    const authSection = document.getElementById('authSection');
    const chatSection = document.getElementById('chatSection');
    const savedUser = localStorage.getItem('user');
    
    logger.logInfo('Token存在:', !!token);
    logger.logInfo('authSection元素存在:', !!authSection);
    logger.logInfo('chatSection元素存在:', !!chatSection);
    logger.logInfo('保存的用户信息:', savedUser);
    
    if (token && authSection && chatSection) {
        logger.logInfo('检测到已登录状态，切换到聊天界面');
        // 显示聊天界面
        authSection.style.display = 'none';
        chatSection.style.display = 'block';
        
        // 退出登录按钮事件监听器已在bindFormEvents中绑定，此处不再重复绑定
        
        // 如果有保存的用户信息，则直接使用
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const userNickname = document.getElementById('userNickname');
                const userUsername = document.getElementById('userUsername');
                const userAvatar = document.getElementById('userAvatar');
                const userId = document.getElementById('userId');
                
                if (userNickname) userNickname.textContent = user.nickname || user.username;
                if (userUsername) userUsername.textContent = user.username;
                if (userAvatar) userAvatar.src = user.avatarUrl || '/default-avatar.png';
                if (userId) userId.textContent = 'UID: ' + (user.id || user.userId);
            } catch (e) {
                logger.logError('解析保存的用户信息失败:', e);
            }
        }
        
        // 获取用户信息
        fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            logger.logInfo('验证Token响应状态:', response.status);
            if (!response.ok) {
                throw new Error('网络响应错误');
            }
            return response.json();
        })
        .then(data => {
            logger.logInfo('获取用户信息响应:', data);
            if (data.valid && data.user) {
                const userNickname = document.getElementById('userNickname');
                const userUsername = document.getElementById('userUsername');
                const userAvatar = document.getElementById('userAvatar');
                const userId = document.getElementById('userId');
                
                if (userNickname) userNickname.textContent = data.user.username; // verify接口不返回nickname
                if (userUsername) userUsername.textContent = data.user.username;
                if (userAvatar) userAvatar.src = '/default-avatar.png'; // verify接口不返回avatarUrl
                if (userId) userId.textContent = 'UID: ' + data.user.id;
                
                // 更新本地存储的用户信息
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('userId', data.user.id);
            } else {
                // Token无效，清除本地存储并显示登录界面
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                authSection.style.display = 'flex';
                chatSection.style.display = 'none';
            }
        })
        .catch(error => {
            logger.logError('获取用户信息失败:', error);
            // 出错时清除本地存储并显示登录界面
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            authSection.style.display = 'flex';
            chatSection.style.display = 'none';
        });
    } else {
        logger.logInfo('未登录或元素缺失，保持登录界面');
        // 确保显示登录界面
        if (authSection) authSection.style.display = 'flex';
        if (chatSection) chatSection.style.display = 'none';
    }
    
    // 绑定表单提交事件
    bindFormEvents();
});

// 绑定表单提交事件
function bindFormEvents() {
    logger.logInfo('绑定表单事件');
    
    // 登录表单提交
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        logger.logInfo('找到登录表单，绑定提交事件');
        loginForm.addEventListener('submit', function(e) {
            logger.logInfo('登录表单提交事件触发');
            e.preventDefault();
            
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            
            if (!usernameInput || !passwordInput) {
                logger.logError('缺少表单元素');
                showMessage('表单元素缺失', 'danger');
                return;
            }
            
            const username = usernameInput.value;
            const password = passwordInput.value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;
            
            logger.logInfo('发送登录请求', { username, rememberMe });
            
            fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            })
            .then(response => {
                logger.logInfo('收到登录响应，状态码:', response.status);
                // 不管响应是否成功，都继续处理
                return response.json().then(data => {
                    // 将响应数据和状态码一起传递下去
                    return { data, status: response.status, ok: response.ok };
                });
            })
            .then(({ data, status, ok }) => {
                logger.logInfo('登录响应数据:', data);
                
                // 检查登录是否成功
                if (ok && data.token && data.user) {
                    logger.logInfo('登录成功');
                    // 保存token和用户信息到localStorage
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userId', data.user.id);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // 更新用户信息显示
                    const userNickname = document.getElementById('userNickname');
                    const userUsername = document.getElementById('userUsername');
                    const userAvatar = document.getElementById('userAvatar');
                    const userId = document.getElementById('userId');
                    
                    if (userNickname) userNickname.textContent = data.user.nickname;
                    if (userUsername) userUsername.textContent = data.user.username;
                    if (userAvatar) userAvatar.src = data.user.avatarUrl || '/default-avatar.png';
                    if (userId) userId.textContent = 'UID: ' + data.user.id;
                    
                    // 切换到聊天界面
                    const authSection = document.getElementById('authSection');
                    const chatSection = document.getElementById('chatSection');
                    
                    logger.logInfo('切换界面元素存在:', { 
                        authSection: !!authSection, 
                        chatSection: !!chatSection 
                    });
                    
                    if (authSection) {
                        authSection.style.display = 'none';
                        logger.logInfo('隐藏登录区域');
                    }
                    if (chatSection) {
                        chatSection.style.display = 'block';
                        logger.logInfo('显示聊天区域');
                    }
                } else {
                    // 登录失败，显示服务器返回的错误信息
                    logger.logInfo('登录失败:', data.message);
                    showMessage(data.message || '登录失败，请检查用户名和密码', 'danger');
                }
            })
            .catch(error => {
                logger.logError('登录错误:', error);
                showMessage('网络错误，请稍后再试', 'danger');
            });
        });
    } else {
        logger.logInfo('未找到登录表单');
    }
    
    // 注册表单提交
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        logger.logInfo('找到注册表单，绑定提交事件');
        registerForm.addEventListener('submit', function(e) {
            logger.logInfo('注册表单提交事件触发');
            e.preventDefault();
            
            const formData = new FormData(this);
            
            fetch('/api/auth/register', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                logger.logInfo('收到注册响应，状态码:', response.status);
                if (!response.ok) {
                    throw new Error('网络响应错误');
                }
                return response.json();
            })
            .then(data => {
                logger.logInfo('注册响应数据:', data);
                if (data.success) {
                    showMessage('注册成功，请登录', 'success');
                    showLoginForm();
                } else {
                    showMessage(data.message || '注册失败', 'danger');
                }
            })
            .catch(error => {
                logger.logError('注册错误:', error);
                showMessage('网络错误，请稍后再试', 'danger');
            });
        });
    } else {
        logger.logInfo('未找到注册表单');
    }
    
    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logger.logInfo('找到退出按钮，绑定点击事件');
        logoutBtn.addEventListener('click', function() {
            // 使用自定义确认框
            showConfirm('确定要退出登录吗？').then(result => {
                if (!result) {
                    return; // 用户取消退出
                }
                
                logger.logInfo('退出按钮点击事件触发');
                
                // 获取token用于请求退出登录接口
                const token = localStorage.getItem('token');
                
                // 调用后端退出登录接口
                if (token) {
                    fetch('/api/auth/logout', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            logger.logWarn('退出登录接口调用失败:', response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        logger.logInfo('退出登录接口响应:', data);
                    })
                    .catch(error => {
                        logger.logError('退出登录接口调用错误:', error);
                    });
                }
                
                // 清除本地存储
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                
                // 切换到登录界面
                const chatSection = document.getElementById('chatSection');
                const authSection = document.getElementById('authSection');
                
                if (chatSection) chatSection.style.display = 'none';
                if (authSection) authSection.style.display = 'flex';
                
                // 清空表单
                const loginForm = document.getElementById('loginForm');
                const registerForm = document.getElementById('registerForm');
                
                if (loginForm) loginForm.reset();
                if (registerForm) registerForm.reset();
                
                // 显示退出成功消息
                showMessage('您已成功退出登录');
            });
        });
    } else {
        logger.logInfo('未找到退出按钮');
    }
    
    // 创建聊天室按钮
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        logger.logInfo('找到创建聊天室按钮，绑定点击事件');
        createRoomBtn.addEventListener('click', function() {
            logger.logInfo('创建聊天室按钮点击事件触发');
            // 显示创建聊天室模态框
            const createRoomModal = new bootstrap.Modal(document.getElementById('createRoomModal'));
            if (createRoomModal) {
                createRoomModal.show();
            }
        });
    } else {
        logger.logInfo('未找到创建聊天室按钮');
    }
    
    // 创建聊天室表单提交事件
    const createRoomForm = document.getElementById('createRoomForm');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
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
                        throw new Error(data.error || '创建失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('createRoomModal'));
                if (modal) {
                    modal.hide();
                }
                
                // 重置表单
                createRoomForm.reset();
                
                // 重新加载聊天室列表
                loadRooms();
                
                // 显示成功消息
                showMessage('聊天室创建成功', 'success');
            })
            .catch(error => {
                logger.logError('创建聊天室失败:', error);
                showMessage(error.message || '创建聊天室失败', 'danger');
            });
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
            const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
            if (settingsModal) {
                settingsModal.show();
            }
        });
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
            logger.logError('搜索聊天室失败:', error);
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
    
    // 加入聊天室
    function joinRoom(roomId) {
        showConfirm('确定要加入这个聊天室吗？').then(result => {
            if (!result) {
                return; // 用户取消
            }
            
            const token = localStorage.getItem('token');
            if (!token) {
                showMessage('未登录，请先登录', 'danger');
                return;
            }
            
            // 这里应该调用加入聊天室的API，暂时显示提示信息
            showMessage('加入聊天室功能将在后续版本中实现', 'info');
        });
    }
    
    // 个人中心表单提交
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        logger.logInfo('找到个人中心表单，绑定提交事件');
        profileForm.addEventListener('submit', function(e) {
            logger.logInfo('个人中心表单提交事件触发');
            e.preventDefault();
            
            const formData = new FormData(this);
            const token = localStorage.getItem('token');
            
            if (!token) {
                showMessage('未登录，请重新登录', 'danger');
                return;
            }
            
            fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })
            .then(response => {
                logger.logInfo('收到个人中心更新响应，状态码:', response.status);
                if (!response.ok) {
                    throw new Error('网络响应错误');
                }
                return response.json();
            })
            .then(data => {
                logger.logInfo('个人中心更新响应数据:', data);
                if (data.success) {
                    showMessage('个人信息更新成功', 'success');
                    
                    // 更新用户信息显示
                    const userNickname = document.getElementById('userNickname');
                    const userAvatar = document.getElementById('userAvatar');
                    const popupNickname = document.getElementById('popupNickname');
                    
                    if (userNickname) userNickname.textContent = data.user.nickname;
                    if (userAvatar) userAvatar.src = data.user.avatar || '/default-avatar.png';
                    if (popupNickname) popupNickname.value = data.user.nickname;
                    
                    closeProfilePopup();
                } else {
                    showMessage(data.message || '更新失败', 'danger');
                }
            })
            .catch(error => {
                logger.logError('更新个人信息错误:', error);
                showMessage('网络错误，请稍后再试', 'danger');
            });
        });
    } else {
        logger.logInfo('未找到个人中心表单');
    }
}