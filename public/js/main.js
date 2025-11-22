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

// 更新个人资料
async function updateProfile(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    try {
        // 显示加载状态
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...';
        
        // 构建基本的用户资料更新数据
        const profileData = {
            nickname: formData.get('nickname')
        };
        
        // 构建偏好设置更新数据
        const preferencesData = {
            themeColor: formData.get('themeColor')
        };
        
        // 检查是否有新的头像文件
        const avatarFile = document.getElementById('avatarInput').files[0];
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }
        
        // 检查是否有新的背景图片文件
        const bgFile = document.getElementById('backgroundImage').files[0];
        if (bgFile) {
            // 上传背景图片
            const bgFormData = new FormData();
            bgFormData.append('background', bgFile);
            
            const bgResponse = await fetch('/api/users/upload-background', {
                method: 'POST',
                body: bgFormData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!bgResponse.ok) {
                throw new Error('背景图片上传失败');
            }
            
            const bgResult = await bgResponse.json();
            preferencesData.backgroundUrl = bgResult.backgroundUrl;
        }
        
        // 更新用户资料（包括头像）
        const profileResponse = await fetch('/api/users/profile', {
            method: 'PUT',
            body: avatarFile ? formData : JSON.stringify(profileData),
            headers: avatarFile ? {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            } : {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!profileResponse.ok) {
            throw new Error('用户资料更新失败');
        }
        
        // 更新偏好设置
        const preferencesResponse = await fetch('/api/users/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(preferencesData)
        });
        
        if (!preferencesResponse.ok) {
            throw new Error('偏好设置更新失败');
        }
        
        // 获取更新后的用户信息
        const profileResult = await profileResponse.json();
        const preferencesResult = await preferencesResponse.json();
        
        // 更新本地存储的用户信息
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = {
            ...currentUser,
            nickname: profileResult.user.nickname,
            avatarUrl: profileResult.user.avatarUrl
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 更新页面上的用户信息显示
        const userNickname = document.getElementById('userNickname');
        const userAvatar = document.getElementById('userAvatar');
        if (userNickname) userNickname.textContent = updatedUser.nickname;
        if (userAvatar) userAvatar.src = updatedUser.avatarUrl;
        
        // 应用新的个性化设置
        const newPreferences = {
            backgroundUrl: preferencesResult.preferences.backgroundUrl,
            themeColor: preferencesResult.preferences.themeColor
        };
        applyUserPreferences(newPreferences);
        
        // 显示成功消息
        showMessage('个人资料更新成功！', 'success');
        
        // 关闭弹窗
        closeProfilePopup();
    } catch (error) {
        console.error('更新个人资料失败:', error);
        showMessage(`更新失败: ${error.message}`, 'danger');
    } finally {
        // 恢复按钮状态
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// 引入前端日志工具
// 使用统一的前端日志工具
const logger = window.logger || {
    logInfo: () => {},
    logWarn: () => {},
    logError: () => {}
};

// 获取用户个性化设置
function getUserPreferences() {
    const token = localStorage.getItem('token');
    if (!token) {
        logger.logWarn('未登录，无法获取用户个性化设置');
        return Promise.reject(new Error('未登录'));
    }
    
    // 定义默认设置
    const defaultPreferences = {
        backgroundUrl: '/wp.jpg',
        themeColor: '#4cd8b8'
    };
    
    return fetch('/api/users/preferences', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        // 添加请求超时处理
        signal: AbortSignal.timeout(10000) // 10秒超时
    })
    .then(response => {
        if (!response) {
            throw new Error('网络连接失败，请检查网络连接');
        }
        
        if (!response.ok) {
            // 根据不同的HTTP状态码提供更具体的错误信息
            switch (response.status) {
                case 401:
                    // Token无效或过期，清除本地存储
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('user');
                    throw new Error('登录已过期，请重新登录');
                    
                case 404:
                    // 如果是404，可能是新用户没有个性化设置，返回默认设置
                    logger.logInfo('用户个性化设置不存在，使用默认设置');
                    applyUserPreferences(defaultPreferences);
                    return defaultPreferences;
                    
                case 500:
                    throw new Error('服务器内部错误，请稍后再试');
                    
                case 502:
                case 503:
                case 504:
                    throw new Error('服务器暂时不可用，请稍后再试');
                    
                default:
                    // 将响应转换为文本以查看详细错误信息
                    return response.text().then(text => {
                        let errorData;
                        try {
                            errorData = JSON.parse(text);
                        } catch (e) {
                            errorData = { message: text || `HTTP ${response.status}: ${response.statusText}` };
                        }
                        throw new Error(errorData.error || errorData.message || `请求失败: HTTP ${response.status}`);
                    });
            }
        }
        
        // 成功响应，解析JSON数据
        return response.json();
    })
    .then(data => {
        // 验证返回的数据结构是否完整
        if (!data || typeof data !== 'object') {
            logger.logWarn('用户个性化设置数据格式不正确，使用默认设置');
            applyUserPreferences(defaultPreferences);
            return defaultPreferences;
        }
        
        // 确保必要的属性存在，缺失时使用默认值
        const safeData = {
            backgroundUrl: data.backgroundUrl || defaultPreferences.backgroundUrl,
            themeColor: data.themeColor || defaultPreferences.themeColor
        };
        
        // 应用用户个性化设置
        applyUserPreferences(safeData);
        return safeData;
    })
    .catch(error => {
        // 区分不同类型的错误
        if (error.name === 'AbortError') {
            logger.logError('获取用户个性化设置超时:', error);
            // 超时时也应用默认设置
            applyUserPreferences(defaultPreferences);
            throw new Error('请求超时，请检查网络连接');
        } else if (error.message.includes('登录已过期')) {
            logger.logError('Token已过期，需要重新登录');
            // 这种情况已经在上面的401处理中清除了token
            throw error;
        } else {
            logger.logError('获取用户个性化设置失败:', error);
            // 对于其他错误，应用默认设置但仍然抛出错误以便调用者处理
            applyUserPreferences(defaultPreferences);
            throw error;
        }
    });
}

// 应用用户个性化设置
function applyUserPreferences(preferences) {
    // 应用自定义背景
    if (preferences.backgroundUrl) {
        document.body.style.backgroundImage = `url('${preferences.backgroundUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundRepeat = 'no-repeat';
    }
    
    // 应用自定义主题色
    if (preferences.themeColor) {
        // 应用主题色到各种按钮元素
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.style.backgroundColor = preferences.themeColor;
        });
        
        // 应用主题色到其他需要着色的元素
        const themeColorElements = document.querySelectorAll('.theme-color-element');
        themeColorElements.forEach(element => {
            element.style.borderColor = preferences.themeColor;
        });
    }
    
    // 将个性化设置保存到localStorage中
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
}

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
        
        // 获取并应用用户个性化设置
        getUserPreferences()
            .then(preferences => {
                logger.logInfo('用户个性化设置加载成功:', preferences);
            })
            .catch(error => {
                logger.logWarn('加载用户个性化设置失败:', error);
                // 使用默认设置
                applyUserPreferences({
                    backgroundUrl: '/wp.jpg',
                    themeColor: '#4cd8b8'
                });
            });
        
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
                
                if (userNickname) userNickname.textContent = data.user.nickname || data.user.username;
                if (userUsername) userUsername.textContent = data.user.username;
                if (userAvatar) userAvatar.src = data.user.avatarUrl || '/default-avatar.png';
                if (userId) userId.textContent = 'UID: ' + (data.user.id || data.user.userId);
                
                // 更新本地存储的用户信息
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('userId', data.user.id || data.user.userId);
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
                    
                    if (authSection && chatSection) {
                        authSection.style.display = 'none';
                        chatSection.style.display = 'block';
                        logger.logInfo('切换到聊天界面');
                        
                        // 获取并应用用户个性化设置
                        getUserPreferences()
                            .then(preferences => {
                                logger.logInfo('用户个性化设置加载成功:', preferences);
                            })
                            .catch(error => {
                                logger.logWarn('加载用户个性化设置失败:', error);
                                // 使用默认设置
                                applyUserPreferences({
                                    backgroundUrl: '/wp.jpg',
                                    themeColor: '#4cd8b8'
                                });
                            });
                            
                        // 加载聊天室列表
                        loadRooms();
                        
                        // 建立WebSocket连接
                        initializeWebSocket(data.token);
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
                localStorage.removeItem('userPreferences');
                
                // 重置页面背景和主题
                document.body.style.backgroundImage = '';
                document.body.style.backgroundColor = '#f8f9fa';
                
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
    
    // 加载聊天室列表
    function loadRooms() {
        const token = localStorage.getItem('token');
        if (!token) {
            logger.logWarn('未登录，无法加载聊天室列表');
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
            logger.logError('加载聊天室列表错误:', error);
            showMessage('加载聊天室列表失败: ' + error.message, 'danger');
        });
    }
    
    // 显示聊天室列表
    function displayRooms(rooms) {
        const roomList = document.getElementById('roomList');
        if (!roomList) {
            logger.logWarn('未找到聊天室列表容器');
            return;
        }
        
        if (!rooms || rooms.length === 0) {
            roomList.innerHTML = '<li class="list-group-item text-center text-muted">暂无聊天室</li>';
            return;
        }
        
        roomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${room.name}</div>
                        ${room.note ? `<small class="text-muted">${room.note}</small>` : ''}
                    </div>
                    ${room.unreadCount > 0 ? 
                        `<span class="badge bg-primary rounded-pill">${room.unreadCount}</span>` : ''}
                </div>
            `;
            li.addEventListener('click', () => {
                // 添加进入聊天室的逻辑
                enterRoom(room);
            });
            roomList.appendChild(li);
        });
    }
    
    // 进入聊天室
    function enterRoom(room) {
        // 检查房间对象和ID的有效性
        if (!room || !room.id || room.id === 'undefined') {
            showMessage('房间信息无效', 'danger');
            return;
        }
        
        // 更新当前聊天室显示
        const currentRoomNameElement = document.getElementById('currentRoomName');
        if (currentRoomNameElement) {
            currentRoomNameElement.textContent = room.note || room.name;
        }
        
        // 保存当前聊天室信息到本地存储
        localStorage.setItem('currentRoomId', room.id);
        localStorage.setItem('currentRoomName', room.name);
        
        // 通过WebSocket加入聊天室
        if (socket && socket.connected) {
            socket.emit('joinRoom', room.id);
        }
        
        // 加载消息历史
        loadMessageHistory(room.id);
        
        // 可以在这里添加更多进入聊天室的逻辑，比如建立WebSocket连接等
        showMessage(`已进入聊天室: ${room.name}`, 'success');
    }
    
    // 加载消息历史
    function loadMessageHistory(roomId) {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('未登录，请先登录', 'danger');
            return;
        }
        
        // 确保roomId是数字类型
        const roomIdInt = parseInt(roomId);
        if (isNaN(roomIdInt)) {
            logger.logError('无效的聊天室ID:', roomId);
            showMessage('无效的聊天室ID', 'danger');
            return;
        }
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            logger.logWarn('未找到消息显示区域');
            return;
        }
        
        // 显示加载中提示
        chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>加载消息中...</p></div>';
        
        fetch(`/api/messages/history/${roomIdInt}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || '加载消息历史失败');
                });
            }
            return response.json();
        })
        .then(async messages => {
            await displayMessages(messages);
        })
        .catch(error => {
            logger.logError('加载消息历史错误:', error);
            chatMessages.innerHTML = `<div class="text-center text-muted my-3"><p>加载消息失败: ${error.message}</p></div>`;
            showMessage('加载消息历史失败: ' + error.message, 'danger');
        });
    }
    
    // 显示消息
    async function displayMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            logger.logWarn('未找到消息显示区域');
            return;
        }
        
        // 如果只有一条消息，将其添加到现有消息列表中
        if (messages.length === 1) {
            const message = messages[0];
            // 检查消息是否已存在
            const existingMessage = chatMessages.querySelector(`.message-item[data-message-id="${message.id}"]`);
            if (existingMessage) {
                // 如果消息已存在，更新内容（可能是撤回的消息）
                existingMessage.innerHTML = await renderMessage(message);
                return;
            }
            
            // 添加新消息
            const messageElement = document.createElement('div');
            messageElement.className = 'message-item mb-3';
            messageElement.setAttribute('data-message-id', message.id);
            messageElement.innerHTML = await renderMessage(message);
            chatMessages.appendChild(messageElement);
        } else {
            // 如果是多条消息（历史消息），替换整个消息列表
            if (!messages || messages.length === 0) {
                chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>暂无消息</p></div>';
                return;
            }
            
            // 使用 Promise.all 并行处理所有消息的渲染
            const renderedMessages = await Promise.all(messages.map(async (message) => {
                const rendered = await renderMessage(message);
                return `
                    <div class="message-item mb-3" data-message-id="${message.id}">
                        ${rendered}
                    </div>
                `;
            }));
            
            chatMessages.innerHTML = renderedMessages.join('');
        }
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 用户信息缓存
    const userCache = new Map();
    const userCacheExpiry = new Map();
    const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

    // 通过UID获取用户信息
    async function getUserInfoById(userId) {
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
    async function renderMessage(message) {
        // 格式化时间
        const messageTime = new Date(message.sentAt || message.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 获取发送者信息
        let senderInfo;
        try {
            // 正确解析用户ID，考虑不同来源的数据结构
            let userId;
            if (message.Sender && typeof message.Sender === 'object') {
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
        } catch (error) {
            console.error('获取发送者信息失败:', error);
            // 使用消息对象中的信息作为备选
            senderInfo = {
                id: message.Sender?.userId || message.Sender?.id || message.userId || 'unknown',
                username: message.Sender?.username || `用户${message.Sender?.userId || message.userId || '未知'}`,
                nickname: message.Sender?.nickname || message.Sender?.username || `用户${message.Sender?.userId || message.userId || '未知'}`,
                avatarUrl: message.Sender?.avatarUrl || '/default-avatar.png'
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
                content = `<img src="${message.fileUrl}" alt="图片" class="message-image" style="max-width: 200px; max-height: 200px;">`;
                break;
            case 'video':
                content = `<video src="${message.fileUrl}" controls class="message-video" style="max-width: 200px; max-height: 200px;"></video>`;
                break;
            case 'file':
                content = `<a href="${message.fileUrl}" target="_blank" class="message-file">文件: ${message.content || '文件'}</a>`;
                break;
            case 'recall':
                content = '<em>消息已被撤回</em>';
                break;
            default:
                content = message.content || '';
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
    
    // 页面加载完成后加载聊天室列表
    const chatSection = document.getElementById('chatSection');
    if (chatSection && chatSection.style.display !== 'none') {
        // 如果聊天界面已显示，则加载聊天室列表
        loadRooms();
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
            logger.logError('获取聊天室成员列表错误:', error);
            showMessage('获取成员列表失败: ' + error.message, 'danger');
        });
    }
    
    // 显示聊天室成员列表
    function displayRoomMembers(members) {
        const membersList = document.getElementById('membersList');
        if (!membersList) {
            logger.logWarn('未找到成员列表容器');
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
                    <div class="text-muted small">UID: ${member.uid}</div>
                </div>
                ${member.isCreator ? '<span class="badge bg-success me-1">群主</span>' : ''}
                ${member.isModerator ? '<span class="badge bg-warning">管理员</span>' : ''}
            </li>
        `).join('');
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
    
    // 设置表单提交事件
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const settingsData = {
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
            
            fetch('/api/rooms/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settingsData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '设置更新失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                if (modal) {
                    modal.hide();
                }
                
                // 重置表单
                settingsForm.reset();
                
                // 重新加载聊天室列表
                loadRooms();
                
                // 显示成功消息
                showMessage('设置更新成功', 'success');
            })
            .catch(error => {
                logger.logError('更新设置失败:', error);
                showMessage(error.message || '更新设置失败', 'danger');
            });
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
        
        let html = '';
        rooms.forEach(room => {
            html += `
            <li class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${room.name}</h6>
                        <small class="text-muted">ID: ${room.id} | 创建者: ${room.creatorNickname} | 成员: ${room.memberCount}人</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary join-room-btn" data-room-id="${room.id}">
                        申请加入
                    </button>
                </div>
            </li>`;
        });
        
        resultsContainer.innerHTML = html;
        
        // 为每个按钮添加事件监听器
        document.querySelectorAll('.join-room-btn').forEach(button => {
            button.addEventListener('click', function() {
                const roomId = this.getAttribute('data-room-id');
                requestToJoinRoom(roomId);
            });
        });
    }
    
    // 申请加入房间函数
    async function requestToJoinRoom(roomId) {
        console.log('申请加入房间:', roomId); // 添加调试日志
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'danger');
            showLoginModal();
            return;
        }

        try {
            console.log('发送请求到: ', `/api/rooms/${roomId}/join-request`); // 添加调试日志
            const response = await fetch(`/api/rooms/${roomId}/join-request`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('收到响应:', response); // 添加调试日志
            const data = await response.json();
            console.log('响应数据:', data); // 添加调试日志
            
            if (response.ok) {
                showMessage('加入请求已发送，等待房主审批', 'success');
            } else {
                showMessage(data.error || '发送加入请求失败', 'danger');
            }
        } catch (error) {
            console.error('发送加入请求失败:', error); // 添加调试日志
            logger.logError('发送加入请求失败:', error);
            showMessage('发送加入请求失败: ' + error.message, 'danger');
        }
    }
    
    // 加入房间函数
    async function joinRoom(roomId) {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'danger');
            showLoginModal();
            return;
        }

        try {
            // 更新当前房间ID
            localStorage.setItem('currentRoomId', roomId);
            
            // 通知服务器加入房间
            if (socket && socket.connected) {
                socket.emit('joinRoom', { roomId });
            }
            
            // 显示房间标题
            const roomTitleElement = document.getElementById('roomTitle');
            if (roomTitleElement) {
                // 获取房间详细信息
                const response = await fetch(`/api/rooms/${roomId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const room = await response.json();
                    roomTitleElement.textContent = room.note || room.name || `房间 ${roomId}`;
                } else {
                    roomTitleElement.textContent = `房间 ${roomId}`;
                }
            }
            
            // 清空消息区域并显示加载状态
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '<div class="text-center text-muted my-3"><p>加载中...</p></div>';
            }
            
            // 加载房间消息历史
            await loadRoomMessages(roomId);
            
            // 切换显示区域
            document.getElementById('welcome-screen').style.display = 'none';
            document.getElementById('chat-container').style.display = 'block';
            
            // 启动自动刷新
            startAutoRefresh();
            
        } catch (error) {
            logger.logError('加入房间失败:', error);
            showMessage('加入房间失败: ' + error.message, 'danger');
        }
    }
    
    // 退出房间函数
    function leaveRoom() {
        // 通知服务器离开房间
        const currentRoomId = localStorage.getItem('currentRoomId');
        if (socket && socket.connected && currentRoomId) {
            socket.emit('leaveRoom', { roomId: currentRoomId });
        }
        
        // 清除当前房间ID
        localStorage.removeItem('currentRoomId');
        
        // 停止自动刷新
        stopAutoRefresh();
        
        // 切换显示区域
        document.getElementById('chat-container').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'block';
        
        // 清空房间标题
        const roomTitleElement = document.getElementById('roomTitle');
        if (roomTitleElement) {
            roomTitleElement.textContent = '';
        }
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
            
            fetch('/api/users/profile', {
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
                    if (userAvatar) userAvatar.src = data.user.avatarUrl || '/default-avatar.png';
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
    
    // 绑定发送消息相关事件
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
            fileInput.onchange = handleFileSelect;
            fileInput.click();
        });
    }
    
    // 处理文件选择
    function handleFileSelect(event) {
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
    function uploadFile(file) {
        const currentRoomId = localStorage.getItem('currentRoomId');
        const token = localStorage.getItem('token');
        
        if (!token) {
            showMessage('未登录，请先登录', 'danger');
            return;
        }
        
        if (!currentRoomId) {
            showMessage('请先选择一个聊天室', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('roomId', currentRoomId);
        
        // 根据文件类型确定上传端点
        let uploadEndpoint = '/api/upload';
        if (file.type.startsWith('image/')) {
            uploadEndpoint = '/api/upload/image';
        } else if (file.type.startsWith('video/')) {
            uploadEndpoint = '/api/upload/video';
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
            logger.logError('文件上传失败:', error);
            showMessage('文件上传失败: ' + error.message, 'danger');
        });
    }
    
    // 上传大文件（分片上传）
    async function uploadLargeFile(file) {
        const currentRoomId = localStorage.getItem('currentRoomId');
        const token = localStorage.getItem('token');
        
        if (!token) {
            showMessage('未登录，请先登录', 'danger');
            return;
        }
        
        if (!currentRoomId) {
            showMessage('请先选择一个聊天室', 'warning');
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
                showMessage(`上传进度: ${progress}% (${i + 1}/${totalChunks})`, 'info');
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
            logger.logError('分片上传失败:', error);
            showMessage('文件上传失败: ' + error.message, 'danger');
        }
    }
    
    // 发送文件消息
    function sendFileMessage(fileUrl, fileName, fileType) {
        const currentRoomId = localStorage.getItem('currentRoomId');
        const token = localStorage.getItem('token');
        
        if (!token) {
            showMessage('未登录，请先登录', 'danger');
            return;
        }
        
        if (!currentRoomId) {
            showMessage('请先选择一个聊天室', 'warning');
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
                content: fileUrl,
                fileName: fileName,
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
            if (messageInput) messageInput.value = '';
        })
        .catch(error => {
            logger.logError('发送文件消息失败:', error);
            showMessage('发送文件消息失败: ' + error.message, 'danger');
        });
    }
    
    // 初始化WebSocket连接
    function initializeWebSocket(token) {
        if (!token) {
            logger.logWarn('未提供token，无法建立WebSocket连接');
            return;
        }
        
        // 创建WebSocket连接
        const socket = io({
            auth: {
                token: token
            }
        });
        
        // 监听连接事件
        socket.on('connect', () => {
            logger.logInfo('WebSocket连接成功');
            
            // 如果有当前聊天室，加入该聊天室
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (currentRoomId) {
                socket.emit('joinRoom', {roomId: currentRoomId});
            }
        });

        // 添加自动刷新机制
        let refreshInterval = null;
        
        // 开始自动刷新
        function startAutoRefresh() {
            // 清除现有的定时器（如果有的话）
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            
            // 每5秒检查一次新消息
            refreshInterval = setInterval(async () => {
                const currentRoomId = localStorage.getItem('currentRoomId');
                if (currentRoomId && token) {
                    try {
                        const response = await fetch(`/api/messages/${currentRoomId}/history?limit=10`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            const messages = data.messages || data;
                            
                            // 检查是否有新消息
                            const chatMessages = document.getElementById('chatMessages');
                            if (chatMessages && messages.length > 0) {
                                // 获取当前显示的消息ID列表
                                const displayedMessageIds = Array.from(
                                    chatMessages.querySelectorAll('.message-item')
                                ).map(el => el.dataset.messageId);
                                
                                // 找出新消息
                                const newMessages = messages.filter(msg => 
                                    !displayedMessageIds.includes(String(msg.messageId || msg.id))
                                );
                                
                                // 如果有新消息，添加到聊天界面
                                if (newMessages.length > 0) {
                                    await displayMessages(newMessages);
                                    
                                    // 滚动到底部
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        }
                    } catch (error) {
                        logger.logError('自动刷新消息失败:', error);
                    }
                }
            }, 5000); // 每5秒刷新一次
        }
        
        // 停止自动刷新
        function stopAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        }
        
        // 当加入房间时启动自动刷新
        socket.on('joinRoom', () => {
            startAutoRefresh();
        });
        
        // 页面隐藏时停止刷新，显示时恢复刷新
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                startAutoRefresh();
            }
        });
        
        // 监听新消息事件
        socket.on('newMessage', async (message) => {
            logger.logInfo('收到新消息:', message);
            // 检查是否是当前聊天室的消息
            const currentRoomId = localStorage.getItem('currentRoomId');
            if (currentRoomId && currentRoomId == message.roomId) {
                // 显示新消息（等待异步渲染完成）
                await displayMessages([message]);
                
                // 滚动到底部
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            } else {
                // 不是当前聊天室的消息，更新房间列表中的未读数
                logger.logInfo('收到其他房间消息，当前房间ID:', currentRoomId);
                updateRoomUnreadCount(message.roomId);
            }
        });
        
        // 监听消息撤回事件
        socket.on('messageRecalled', (data) => {
            const messageElements = document.querySelectorAll(`.message-item[data-message-id="${data.messageId}"]`);
            messageElements.forEach(element => {
                renderMessage({
                    id: data.messageId,
                    type: 'recall',
                    content: '[已撤回]'
                }).then(renderedMessage => {
                    element.innerHTML = renderedMessage;
                });
            });
        });
        
        // 监听未读计数更新事件
        socket.on('unreadCountUpdate', (data) => {
            // 更新未读计数显示
            updateUnreadCount(data.count);
        });
        
        // 监听连接错误事件
        socket.on('connect_error', (error) => {
            logger.logError('WebSocket连接错误:', error);
        });
        
        // 监听断开连接事件
        socket.on('disconnect', () => {
            logger.logInfo('WebSocket连接断开');
        });
        
        return socket;
    }
    
    // 更新未读计数显示
    function updateUnreadCount(count) {
        // 这里可以更新UI上的未读计数显示
        logger.logInfo('未读消息数更新:', count);
    }
    
    // 更新房间未读数显示
    function updateRoomUnreadCount(roomId) {
        // 获取房间列表中对应的房间项
        const roomItem = document.querySelector(`#room-${roomId}`);
        if (roomItem) {
            // 查找未读数标记元素
            let unreadBadge = roomItem.querySelector('.unread-badge');
            if (!unreadBadge) {
                // 如果不存在未读数标记，则创建一个
                unreadBadge = document.createElement('span');
                unreadBadge.className = 'unread-badge badge bg-danger ms-2';
                unreadBadge.textContent = '1';
                // 将未读数标记添加到房间项中
                const roomNameSpan = roomItem.querySelector('.room-name');
                if (roomNameSpan) {
                    roomNameSpan.appendChild(unreadBadge);
                }
            } else {
                // 如果存在未读数标记，则增加计数
                const currentCount = parseInt(unreadBadge.textContent) || 0;
                unreadBadge.textContent = currentCount + 1;
            }
        }
    }
    
    // 发送消息函数
    function sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const currentRoomId = localStorage.getItem('currentRoomId');
        const token = localStorage.getItem('token');
        
        if (!token) {
            showMessage('未登录，请先登录', 'danger');
            return;
        }
        
        if (!currentRoomId) {
            showMessage('请先选择一个聊天室', 'warning');
            return;
        }
        
        const content = messageInput.value.trim();
        if (!content) {
            showMessage('消息内容不能为空', 'warning');
            return;
        }
        
        // 获取当前用户信息
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        // 创建临时消息对象用于立即显示
        const tempMessage = {
            id: Date.now(), // 临时ID
            content: content,
            type: 'text',
            sentAt: new Date().toISOString(),
            Sender: {
                nickname: currentUser.nickname || currentUser.username,
                username: currentUser.username,
                avatarUrl: currentUser.avatar || '/default-avatar.png'
            }
        };
        
        // 立即显示消息
        displayMessages([tempMessage]);
        
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
                const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessage.id}"]`);
                if (tempMessageElement) {
                    renderMessage(data).then(renderedMessage => {
                        tempMessageElement.outerHTML = renderedMessage;
                    });
                }
            }
        })
        .catch(error => {
            logger.logError('发送消息失败:', error);
            showMessage(error.message || '发送消息失败', 'danger');
            
            // 移除临时消息
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const tempMessageElement = chatMessages.querySelector(`.message-item[data-message-id="${tempMessage.id}"]`);
                if (tempMessageElement) {
                    tempMessageElement.remove();
                }
            }
        });
    }
    
    // 初始化WebSocket连接（已在登录时初始化）
    let socket = null;
    const token = localStorage.getItem('token');
    if (token) {
        // 使用查询参数传递token
        socket = io({
            query: {
                token: token
            }
        });
    } else {
        socket = io();
    }
    
    // 加载聊天室设置
    const roomSettingsBtn = document.getElementById('settingsBtn');
    if (roomSettingsBtn) {
        roomSettingsBtn.addEventListener('click', function() {
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
                
                // 显示设置模态框
                const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
                if (settingsModal) {
                    settingsModal.show();
                }
            })
            .catch(error => {
                logger.logError('获取聊天室设置错误:', error);
                showMessage('获取聊天室设置失败: ' + error.message, 'danger');
            });
        });
    }
    
    // 保存聊天室设置
    const roomSettingsForm = document.getElementById('roomSettingsForm');
    if (roomSettingsForm) {
        roomSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
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
            
            const formData = new FormData(this);
            const settingsData = {
                name: formData.get('name'),
                requireApproval: formData.get('requireApproval') === 'on',
                allowImages: formData.get('allowImages') === 'on',
                allowVideos: formData.get('allowVideos') === 'on',
                allowFiles: formData.get('allowFiles') === 'on'
            };
            
            fetch(`/api/rooms/${currentRoomId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(settingsData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '保存失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                // 关闭模态框
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                if (modal) {
                    modal.hide();
                }
                
                // 重置表单
                roomSettingsForm.reset();
                
                // 重新加载聊天室列表
                loadRooms();
                
                // 显示成功消息
                showMessage('设置保存成功', 'success');
            })
            .catch(error => {
                logger.logError('保存设置失败:', error);
                showMessage(error.message || '保存设置失败', 'danger');
            });
        });
    }
    
    // 手动刷新消息
    async function refreshMessages() {
        const currentRoomId = localStorage.getItem('currentRoomId');
        const token = localStorage.getItem('token');
        
        if (!currentRoomId || !token) {
            return;
        }
        
        try {
            const response = await fetch(`/api/messages/${currentRoomId}/history?limit=50`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const messages = data.messages || data;
                
                // 清空当前消息并重新显示
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                    await displayMessages(messages.reverse()); // 反转消息顺序以正确显示
                    
                    // 滚动到底部
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                showMessage('消息已刷新', 'success');
            } else {
                showMessage('刷新消息失败', 'danger');
            }
        } catch (error) {
            logger.logError('刷新消息失败:', error);
            showMessage('刷新消息失败: ' + error.message, 'danger');
        }
    }
    
    // 初始化聊天功能
    async function initChat() {
        logger.logInfo('初始化聊天功能');
        
        // 初始化WebSocket连接
        initWebSocket();
        
        // 检查是否有保存的房间ID，如果有则加入该房间
        const savedRoomId = localStorage.getItem('currentRoomId');
        if (savedRoomId) {
            await joinRoom(savedRoomId);
        }
        
        // 绑定发送消息事件
        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', handleSendMessage);
        }
        
        // 绑定退出房间事件
        const leaveRoomBtn = document.getElementById('leaveRoomBtn');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', leaveRoom);
        }
        
        // 绑定刷新消息事件
        const refreshMessagesBtn = document.getElementById('refreshMessagesBtn');
        if (refreshMessagesBtn) {
            refreshMessagesBtn.addEventListener('click', refreshMessages);
        }
    }
}