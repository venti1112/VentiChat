// 用户认证模块

// 页面加载时检查登录状态
export function checkLoginStatus() {
    console.info('页面加载完成，检查登录状态');
    const token = localStorage.getItem('token');
    const authSection = document.getElementById('authSection');
    const chatSection = document.getElementById('chatSection');
    const savedUser = localStorage.getItem('user');
    
    console.info('Token存在:', !!token);
    console.info('authSection元素存在:', !!authSection);
    console.info('chatSection元素存在:', !!chatSection);
    console.info('保存的用户信息:', savedUser);
    
    if (token && authSection && chatSection) {
        console.info('检测到已登录状态，切换到聊天界面');
        // 显示聊天界面
        authSection.style.display = 'none';
        chatSection.style.display = 'block';
        
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
                console.error('解析保存的用户信息失败:', e);
            }
        }
        
        // 获取并应用用户个性化设置
        getUserPreferences()
            .then(preferences => {
                console.info('用户个性化设置加载成功:', preferences);
            })
            .catch(error => {
                console.warn('加载用户个性化设置失败:', error);
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
            console.info('验证Token响应状态:', response.status);
            if (!response.ok) {
                throw new Error('网络响应错误');
            }
            return response.json();
        })
        .then(data => {
            console.info('获取用户信息响应:', data);
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
            console.error('获取用户信息失败:', error);
            // 出错时清除本地存储并显示登录界面
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            authSection.style.display = 'flex';
            chatSection.style.display = 'none';
        });
    } else {
        console.info('未登录或元素缺失，保持登录界面');
        // 确保显示登录界面
        if (authSection) authSection.style.display = 'flex';
        if (chatSection) chatSection.style.display = 'none';
    }
    
    // 绑定表单提交事件
    bindFormEvents();
}

// 绑定表单提交事件
export function bindFormEvents() {
    console.info('绑定表单事件');
    
    // 登录表单提交
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.info('找到登录表单，绑定提交事件');
        loginForm.addEventListener('submit', function(e) {
            console.info('登录表单提交事件触发');
            e.preventDefault();
            
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            
            if (!usernameInput || !passwordInput) {
                console.error('缺少表单元素');
                window.showMessage('表单元素缺失', 'danger');
                return;
            }
            
            const username = usernameInput.value;
            const password = passwordInput.value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;
            
            console.info('发送登录请求', { username, rememberMe });
            
            fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            })
            .then(response => {
                console.info('收到登录响应，状态码:', response.status);
                // 不管响应是否成功，都继续处理
                return response.json().then(data => {
                    // 将响应数据和状态码一起传递下去
                    return { data, status: response.status, ok: response.ok };
                });
            })
            .then(({ data, status, ok }) => {
                console.info('登录响应数据:', data);
                
                // 检查登录是否成功
                if (ok && data.token && data.user) {
                    console.info('登录成功');
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
                    
                    console.info('切换界面元素存在:', { 
                        authSection: !!authSection, 
                        chatSection: !!chatSection 
                    });
                    
                    if (authSection && chatSection) {
                        authSection.style.display = 'none';
                        chatSection.style.display = 'block';
                        console.info('切换到聊天界面');
                        
                        // 获取并应用用户个性化设置
                        getUserPreferences()
                            .then(preferences => {
                                console.info('用户个性化设置加载成功:', preferences);
                            })
                            .catch(error => {
                                console.warn('加载用户个性化设置失败:', error);
                                // 使用默认设置
                                applyUserPreferences({
                                    backgroundUrl: '/wp.jpg',
                                    themeColor: '#4cd8b8'
                                });
                            });
                            
                        // 加载聊天室列表
                        window.loadRooms();
                        
                        // 建立WebSocket连接
                        window.initializeWebSocket(data.token);
                    }
                } else {
                    // 登录失败，显示服务器返回的错误信息
                    console.info('登录失败:', data.message);
                    window.showMessage(data.message || '登录失败，请检查用户名和密码', 'danger');
                }
            })
            .catch(error => {
                console.error('登录错误:', error);
                window.showMessage('网络错误，请稍后再试', 'danger');
            });
        });
    } else {
        console.info('未找到登录表单');
    }
    
    // 注册表单提交
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        
        fetch('/api/auth/register', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.showMessage('注册成功，请登录');
                window.showLoginForm();
            } else {
                window.showMessage(data.message || '注册失败');
            }
        })
        .catch(error => {
            window.showMessage('网络错误，请稍后再试', 'danger', '注册失败');
        });
    });
    
    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        console.info('找到退出按钮，绑定点击事件');
        logoutBtn.addEventListener('click', function() {
            // 使用自定义确认框
            window.showConfirm('确定要退出登录吗？').then(result => {
                if (!result) {
                    return; // 用户取消退出
                }
                
                console.info('退出按钮点击事件触发');
                
                // 获取token用于请求退出登录接口
                const token = localStorage.getItem('token');
                
                // 调用后端退出登录接口
                if (token) {
                    fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            console.warn('退出登录接口调用失败:', response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.info('退出登录接口响应:', data);
                    })
                    .catch(error => {
                        console.error('退出登录接口调用错误:', error);
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
                
                // 重置所有按钮的主题色
                const buttons = document.querySelectorAll('.btn');
                buttons.forEach(button => {
                    button.style.backgroundColor = '';
                    button.style.borderColor = '';
                });
                
                // 重置其他使用主题色的元素
                const themeColorElements = document.querySelectorAll('.theme-color-element');
                themeColorElements.forEach(element => {
                    element.style.borderColor = '';
                });
                
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
                window.showMessage('您已成功退出登录');
            });
        });
    } else {
        console.info('未找到退出按钮');
    }
}

// 获取用户个性化设置
export function getUserPreferences() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('未登录，无法获取用户个性化设置');
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
                    console.info('用户个性化设置不存在，使用默认设置');
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
            console.warn('用户个性化设置数据格式不正确，使用默认设置');
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
            console.error('获取用户个性化设置超时:', error);
            // 超时时也应用默认设置
            applyUserPreferences(defaultPreferences);
            throw new Error('请求超时，请检查网络连接');
        } else if (error.message.includes('登录已过期')) {
            console.error('Token已过期，需要重新登录');
            // 这种情况已经在上面的401处理中清除了token
            throw error;
        } else {
            console.error('获取用户个性化设置失败:', error);
            // 对于其他错误，应用默认设置但仍然抛出错误以便调用者处理
            applyUserPreferences(defaultPreferences);
            throw error;
        }
    });
}

// 应用用户个性化设置
export function applyUserPreferences(preferences) {
    // 应用自定义背景
    if (preferences.backgroundUrl) {
        document.body.style.backgroundImage = `url('${preferences.backgroundUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundRepeat = 'no-repeat';
    }
    
    // 应用自定义主题色
    if (preferences.themeColor) {
        // 为body元素设置data-theme-color属性
        document.body.setAttribute('data-theme-color', preferences.themeColor);
        
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
    } else {
        // 如果没有自定义主题色，移除data-theme-color属性
        document.body.removeAttribute('data-theme-color');
    }
    
    // 将个性化设置保存到localStorage中
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
}