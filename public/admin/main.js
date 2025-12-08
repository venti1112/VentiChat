// 当前活动页面
let currentPage = 'dashboard';

// 页面切换
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // 更新活动链接
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // 切换页面内容
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');
        
        // 更新页面标题
        document.getElementById('page-title').textContent = getPageTitle(page);
        
        // 加载页面数据
        loadPageData(page);
        
        currentPage = page;
    });
});

// 获取页面标题
function getPageTitle(page) {
    const titles = {
        dashboard: '仪表盘',
        users: '用户管理',
        rooms: '聊天室管理',
        settings: '系统设置'
    };
    return titles[page] || '';
}

// 加载页面数据
function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'rooms':
            loadRoomsData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// 加载仪表盘数据
async function loadDashboardData() {
    try {
        // 获取用户总数
        const usersResponse = await fetch('/api/admin/users');
        const users = await usersResponse.json();
        document.getElementById('total-users').textContent = users.length;
        
        // 获取聊天室总数
        const roomsResponse = await fetch('/api/admin/rooms');
        const rooms = await roomsResponse.json();
        document.getElementById('total-rooms').textContent = rooms.length;
        
        // 在线用户数暂时显示为0，后续需要实现WebSocket连接统计
        document.getElementById('online-users').textContent = '0';
        
        // 服务器状态
        document.getElementById('server-status').innerHTML = '<span class="badge bg-success">正常运行</span>';
        
        // 系统信息
        // 通过后端API获取Node.js版本和操作系统信息
        try {
            const sysInfoResponse = await fetch('/api/system/info');
            if (sysInfoResponse.ok) {
                const sysInfo = await sysInfoResponse.json();
                document.getElementById('node-version').textContent = sysInfo.nodeVersion || '-';
                document.getElementById('os-info').textContent = sysInfo.osInfo || '-';
                document.getElementById('arch-info').textContent = sysInfo.arch || '-';
                document.getElementById('cpu-info').textContent = sysInfo.cpus || '-';
                document.getElementById('total-mem-info').textContent = sysInfo.totalmem || '-';
                document.getElementById('free-mem-info').textContent = sysInfo.freemem || '-';
            } else {
                document.getElementById('node-version').textContent = '未知';
                document.getElementById('os-info').textContent = '未知';
                document.getElementById('arch-info').textContent = '未知';
                document.getElementById('cpu-info').textContent = '未知';
                document.getElementById('total-mem-info').textContent = '未知';
                document.getElementById('free-mem-info').textContent = '未知';
            }
        } catch (error) {
            document.getElementById('node-version').textContent = '获取失败';
            document.getElementById('os-info').textContent = '获取失败';
            document.getElementById('arch-info').textContent = '获取失败';
            document.getElementById('cpu-info').textContent = '获取失败';
            document.getElementById('total-mem-info').textContent = '获取失败';
            document.getElementById('free-mem-info').textContent = '获取失败';
        }
    } catch (error) {
        console.error('加载仪表盘数据失败:', error);
    }
}

// 加载用户数据
async function loadUsersData() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.nickname}</td>
                <td>${getUserStatusText(user.status)}</td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-user-btn" data-user-id="${user.id}">编辑</button>
                    <button class="btn btn-sm btn-danger ban-user-btn" data-user-id="${user.id}">封禁</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // 绑定编辑按钮事件
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                openEditUserModal(userId);
            });
        });
        
        // 绑定封禁按钮事件
        document.querySelectorAll('.ban-user-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                banUser(userId);
            });
        });
    } catch (error) {
        console.error('加载用户数据失败:', error);
    }
}

// 获取用户状态文本
function getUserStatusText(status) {
    // 简化状态显示：只显示正常和封禁
    return status === 'banned' ? '封禁' : '正常';
}

// 打开编辑用户模态框
async function openEditUserModal(userId) {
    try {
        // 这里应该获取用户详细信息，目前我们只是打开模态框
        document.getElementById('edit-user-id').value = userId;
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    } catch (error) {
        console.error('打开编辑用户模态框失败:', error);
    }
}

// 封禁用户
async function banUser(userId) {
    if (!confirm('确定要封禁该用户吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'banned' })
        });
        
        if (response.ok) {
            alert('用户已封禁');
            loadUsersData(); // 重新加载用户列表
        } else {
            const result = await response.json();
            alert('封禁用户失败: ' + result.error);
        }
    } catch (error) {
        console.error('封禁用户失败:', error);
        alert('封禁用户失败: ' + error.message);
    }
}

// 加载聊天室数据
async function loadRoomsData() {
    try {
        const response = await fetch('/api/admin/rooms');
        const rooms = await response.json();
        
        const tbody = document.getElementById('rooms-table-body');
        tbody.innerHTML = '';
        
        rooms.forEach(room => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${room.roomId}</td>
                <td>${room.name}</td>
                <td>${room.isPrivate ? '私有' : '公共'}</td>
                <td>${room.creatorId || '未知'}</td>
                <td>${room.memberCount >= 0 ? room.memberCount : 0}</td>
                <td>
                    <button class="btn btn-sm btn-info view-members-btn" data-room-id="${room.roomId}">成员</button>
                    <button class="btn btn-sm btn-danger delete-room-btn" data-room-id="${room.roomId}">删除</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // 绑定查看成员按钮事件
        document.querySelectorAll('.view-members-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const roomId = this.getAttribute('data-room-id');
                viewRoomMembers(roomId);
            });
        });
        
        // 绑定删除按钮事件
        document.querySelectorAll('.delete-room-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const roomId = this.getAttribute('data-room-id');
                deleteRoom(roomId);
            });
        });
    } catch (error) {
        console.error('加载聊天室数据失败:', error);
    }
}

// 查看聊天室成员
async function viewRoomMembers(roomId) {
    try {
        const response = await fetch(`/api/rooms/${roomId}/members`);
        const members = await response.json();
        
        const membersList = document.getElementById('room-members-list');
        membersList.innerHTML = '';
        
        members.forEach(member => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.username}</td>
                <td>${member.nickname}</td>
                <td>${member.isModerator ? '管理员' : '普通成员'}</td>
            `;
            membersList.appendChild(row);
        });
        
        const modal = new bootstrap.Modal(document.getElementById('roomMembersModal'));
        modal.show();
    } catch (error) {
        console.error('查看聊天室成员失败:', error);
        alert('查看聊天室成员失败: ' + error.message);
    }
}

// 删除聊天室
async function deleteRoom(roomId) {
    if (!confirm('确定要删除该聊天室吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/rooms/${roomId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('聊天室已删除');
            loadRoomsData(); // 重新加载聊天室列表
        } else {
            const result = await response.json();
            alert('删除聊天室失败: ' + result.error);
        }
    } catch (error) {
        console.error('删除聊天室失败:', error);
        alert('删除聊天室失败: ' + error.message);
    }
}

// 加载设置数据
async function loadSettingsData() {
    try {
        // 获取基本设置
        const settingsResponse = await fetch('/api/system/settings');
        const settings = await settingsResponse.json();
        
        if (settings.success) {
            document.getElementById('site-name').value = settings.data.siteName || '';
            document.getElementById('message-retention-days').value = settings.data.messageRetentionDays || 180;
            document.getElementById('max-file-size').value = settings.data.maxFileSize || 10485760;
        }
        
        // 获取系统配置
        const configResponse = await fetch('/api/admin/config');
        const config = await configResponse.json();
        
        if (config.success) {
            document.getElementById('db-host').value = config.data.db?.host || '';
            document.getElementById('db-port').value = config.data.db?.port || '';
            document.getElementById('db-user').value = config.data.db?.user || '';
            // 密码字段不显示原有值
            document.getElementById('db-name').value = config.data.db?.database || '';
            document.getElementById('redis-host').value = config.data.redis?.host || '';
            document.getElementById('redis-port').value = config.data.redis?.port || '';
            document.getElementById('redis-password').value = ''; // 不显示密码
            document.getElementById('base-url').value = config.data.baseUrl || '';
            document.getElementById('server-port').value = config.data.port || '';
            document.getElementById('encryption-key').value = config.data.encryptionKey || '';
            document.getElementById('log-level').value = config.data.logLevel || 'INFO';
            document.getElementById('worker-threads').value = config.data.workerThreads !== undefined ? config.data.workerThreads : '';
        }
    } catch (error) {
        console.error('加载设置数据失败:', error);
    }
}

// 保存基本设置
document.getElementById('basic-settings-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const settings = {
            siteName: document.getElementById('site-name').value,
            messageRetentionDays: parseInt(document.getElementById('message-retention-days').value),
            maxFileSize: parseInt(document.getElementById('max-file-size').value)
        };
        
        const response = await fetch('/api/system/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            alert('基本设置保存成功');
        } else {
            const result = await response.json();
            alert('保存基本设置失败: ' + result.error);
        }
    } catch (error) {
        console.error('保存基本设置失败:', error);
        alert('保存基本设置失败: ' + error.message);
    }
});

// 保存系统配置
document.getElementById('system-config-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        // 构建配置对象
        const config = {
            db: {
                host: document.getElementById('db-host').value,
                port: parseInt(document.getElementById('db-port').value),
                user: document.getElementById('db-user').value,
                password: document.getElementById('db-password').value || undefined,
                database: document.getElementById('db-name').value
            },
            redis: {
                host: document.getElementById('redis-host').value,
                port: parseInt(document.getElementById('redis-port').value),
                password: document.getElementById('redis-password').value || undefined
            },
            baseUrl: document.getElementById('base-url').value,
            port: parseInt(document.getElementById('server-port').value),
            encryptionKey: document.getElementById('encryption-key').value,
            logLevel: document.getElementById('log-level').value,
            workerThreads: parseInt(document.getElementById('worker-threads').value)
        };
        
        // 移除空值字段
        if (!config.db.password) {
            delete config.db.password;
        }
        
        if (!config.redis.password) {
            delete config.redis.password;
        }
        
        const response = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            alert('系统配置保存成功');
        } else {
            const result = await response.json();
            alert('保存系统配置失败: ' + result.error);
        }
    } catch (error) {
        console.error('保存系统配置失败:', error);
        alert('保存系统配置失败: ' + error.message);
    }
});

// 删除所有聊天记录
document.getElementById('clear-all-messages').addEventListener('click', async function() {
    if (!confirm('确定要删除所有聊天记录吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/messages/clear', {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('所有聊天记录已删除');
        } else {
            const result = await response.json();
            alert('删除聊天记录失败: ' + result.error);
        }
    } catch (error) {
        console.error('删除聊天记录失败:', error);
        alert('删除聊天记录失败: ' + error.message);
    }
});

// 保存用户信息
document.getElementById('save-user-btn').addEventListener('click', async function() {
    try {
        const userId = document.getElementById('edit-user-id').value;
        const username = document.getElementById('edit-username').value;
        const nickname = document.getElementById('edit-nickname').value;
        const password = document.getElementById('edit-password').value;
        const status = document.getElementById('edit-status').value;
        const isAdmin = document.getElementById('edit-is-admin').checked;
        
        // 构造要更新的数据
        const userData = { username, nickname, status };
        if (password) {
            userData.password = password;
        }
        userData.isAdmin = isAdmin;
        
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            alert('用户信息更新成功');
            const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
            modal.hide();
            loadUsersData(); // 重新加载用户列表
        } else {
            const result = await response.json();
            alert('更新用户信息失败: ' + result.error);
        }
    } catch (error) {
        console.error('更新用户信息失败:', error);
        alert('更新用户信息失败: ' + error.message);
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPageData(currentPage);
});