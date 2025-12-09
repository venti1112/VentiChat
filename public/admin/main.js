// 当前活动页面
let currentPage = 'dashboard';
let resourceChart = null;
let networkDiskChart = null;
let systemMetricsInterval = null; // 用于定期更新系统指标

// 监听侧边栏折叠事件，移动端点击菜单项后自动收起侧边栏
document.addEventListener('DOMContentLoaded', function() {
    // 获取所有导航链接
    const navLinks = document.querySelectorAll('.nav-link');
    
    // 为每个导航链接添加点击事件监听器
    navLinks.forEach(link => {
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
            
            // 在移动端，点击菜单项后收起侧边栏
            if (window.innerWidth < 768) {
                const sidebar = document.getElementById('sidebarMenu');
                const bsCollapse = new bootstrap.Collapse(sidebar, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        });
    });
    
    // 初始化仪表盘图表
    initDashboardCharts();
    
    // 绑定快捷操作按钮事件
    bindQuickActionButtons();
    
    // 绑定用户管理页面事件
    bindUserManagementEvents();
    
    // 绑定聊天室管理页面事件
    bindRoomManagementEvents();
    
    // 绑定周期选择下拉菜单事件
    bindPeriodDropdownEvents();
});

// 开始实时更新系统指标
function startRealTimeSystemMetrics() {
    // 如果已经有定时器在运行，则先清除
    if (systemMetricsInterval) {
        clearInterval(systemMetricsInterval);
    }
    
    // 每5秒获取一次实时系统指标
    systemMetricsInterval = setInterval(() => {
        if (currentPage === 'dashboard') {
            updateRealTimeSystemMetrics();
        }
    }, 5000);
}

// 停止实时更新系统指标
function stopRealTimeSystemMetrics() {
    if (systemMetricsInterval) {
        clearInterval(systemMetricsInterval);
        systemMetricsInterval = null;
    }
}

// 更新实时系统指标
async function updateRealTimeSystemMetrics() {
    try {
        // 获取实时系统指标
        const metricsResponse = await fetch('/api/system/metrics');
        if (metricsResponse.ok) {
            const metricsData = await metricsResponse.json();
            
            // 更新在线用户数
            document.getElementById('online-users').textContent = metricsData.data.onlineUsers || 0;
            
            // 更新当前指标显示
            updateCurrentMetrics(metricsData.data);
            
            // 更新图表数据
            updateResourceChartsWithLatest(metricsData.data);
        }
    } catch (error) {
        console.error('获取实时系统指标失败:', error);
    }
}

// 更新当前系统指标显示
function updateCurrentMetrics(metrics) {
    document.getElementById('current-cpu').textContent = metrics.cpu + '%';
    document.getElementById('current-memory').textContent = metrics.memory + '%';
    document.getElementById('current-network').textContent = 
        `↓${metrics.network.received} KB/s ↑${metrics.network.transmitted} KB/s`;
    document.getElementById('current-disk').textContent = 
        `R:${metrics.diskIO.read} KB/s W:${metrics.diskIO.write} KB/s`;
}

// 使用最新数据更新资源图表
function updateResourceChartsWithLatest(latestMetrics) {
    if (!resourceChart || !networkDiskChart) return;
    
    // 更新CPU和内存图表
    // 如果数据点超过30个，则移除最旧的数据点
    if (resourceChart.data.labels.length >= 30) {
        resourceChart.data.labels.shift();
        resourceChart.data.datasets[0].data.shift();
        resourceChart.data.datasets[1].data.shift();
    }
    
    // 添加新的时间标签
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    resourceChart.data.labels.push(timeLabel);
    
    // 添加新的数据点
    resourceChart.data.datasets[0].data.push(latestMetrics.cpu);
    resourceChart.data.datasets[1].data.push(latestMetrics.memory);
    resourceChart.update();
    
    // 更新网络和磁盘IO图表
    // 如果数据点超过30个，则移除最旧的数据点
    if (networkDiskChart.data.labels.length >= 30) {
        networkDiskChart.data.labels.shift();
        networkDiskChart.data.datasets[0].data.shift();
        networkDiskChart.data.datasets[1].data.shift();
        // 如果有四个数据集（网络接收、网络发送、磁盘读取、磁盘写入）
        if (networkDiskChart.data.datasets.length >= 4) {
            networkDiskChart.data.datasets[2].data.shift();
            networkDiskChart.data.datasets[3].data.shift();
        }
    }
    
    // 添加新的时间标签
    networkDiskChart.data.labels.push(timeLabel);
    
    // 添加新的数据点（网络接收和发送）
    networkDiskChart.data.datasets[0].data.push(latestMetrics.network.received);
    networkDiskChart.data.datasets[1].data.push(latestMetrics.network.transmitted);
    
    // 如果有四个数据集，添加磁盘IO数据
    if (networkDiskChart.data.datasets.length >= 4) {
        networkDiskChart.data.datasets[2].data.push(latestMetrics.diskIO.read);
        networkDiskChart.data.datasets[3].data.push(latestMetrics.diskIO.write);
    }
    
    networkDiskChart.update();
}

// 初始化仪表盘图表
function initDashboardCharts() {
    const ctx1 = document.getElementById('resourceChart').getContext('2d');
    resourceChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPU使用率 (%)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                },
                {
                    label: '内存使用率 (%)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
    
    const ctx2 = document.getElementById('networkDiskChart').getContext('2d');
    networkDiskChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '网络接收 (KB/s)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                },
                {
                    label: '网络发送 (KB/s)',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    tension: 0.1
                },
                {
                    label: '磁盘读取 (KB/s)',
                    data: [],
                    borderColor: 'rgb(255, 159, 64)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    tension: 0.1
                },
                {
                    label: '磁盘写入 (KB/s)',
                    data: [],
                    borderColor: 'rgb(255, 205, 86)',
                    backgroundColor: 'rgba(255, 205, 86, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 更新系统资源图表
function updateResourceCharts(metricsHistory) {
    if (!resourceChart || !networkDiskChart) return;
    
    // 获取当前时间
    const now = new Date();
    // 计算12小时前的时间戳
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    // 过滤出最近12小时的数据
    const recentMetrics = metricsHistory.filter(point => new Date(point.timestamp) >= twelveHoursAgo);
    
    // 如果没有近期数据但有历史数据，则使用最后100个数据点
    let dataToUse = recentMetrics;
    if (recentMetrics.length === 0 && metricsHistory.length > 0) {
        // 使用最后100个数据点或全部数据（取较小值）
        const startIndex = Math.max(0, metricsHistory.length - 100);
        dataToUse = metricsHistory.slice(startIndex);
    }
    
    // 准备数据
    const labels = dataToUse.map(point => {
        const date = new Date(point.timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    });
    
    const cpuData = dataToUse.map(point => point.cpu);
    const memoryData = dataToUse.map(point => point.memory);
    const networkReceivedData = dataToUse.map(point => point.network.received);
    const networkTransmittedData = dataToUse.map(point => point.network.transmitted);
    const diskReadData = dataToUse.map(point => point.diskIO.read);
    const diskWriteData = dataToUse.map(point => point.diskIO.write);
    
    // 更新CPU和内存图表
    resourceChart.data.labels = labels;
    resourceChart.data.datasets[0].data = cpuData;
    resourceChart.data.datasets[1].data = memoryData;
    resourceChart.update();
    
    // 更新网络和磁盘IO图表
    networkDiskChart.data.labels = labels;
    networkDiskChart.data.datasets[0].data = networkReceivedData;
    networkDiskChart.data.datasets[1].data = networkTransmittedData;
    if (networkDiskChart.data.datasets.length >= 4) {
        networkDiskChart.data.datasets[2].data = diskReadData;
        networkDiskChart.data.datasets[3].data = diskWriteData;
    }
    networkDiskChart.update();
}

// 绑定周期选择下拉菜单事件
function bindPeriodDropdownEvents() {
    // 资源周期选择
    document.querySelectorAll('#resourcePeriodDropdown + .dropdown-menu .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const period = this.getAttribute('data-period');
            document.getElementById('resourcePeriodDropdown').textContent = this.textContent;
            // 重新加载仪表盘数据
            loadDashboardData();
        });
    });
    
    // 网络磁盘周期选择
    document.querySelectorAll('#networkDiskPeriodDropdown + .dropdown-menu .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const period = this.getAttribute('data-period');
            document.getElementById('networkDiskPeriodDropdown').textContent = this.textContent;
            // 重新加载仪表盘数据
            loadDashboardData();
        });
    });
}

// 绑定快捷操作按钮事件
function bindQuickActionButtons() {
    // 刷新仪表盘数据
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadDashboardData();
        });
    }
    
    // 查看所有用户
    const viewAllUsersBtn = document.getElementById('view-all-users');
    if (viewAllUsersBtn) {
        viewAllUsersBtn.addEventListener('click', function() {
            // 切换到用户管理页面
            document.querySelector('.nav-link[data-page="users"]').click();
        });
    }
    
    // 查看所有聊天室
    const viewAllRoomsBtn = document.getElementById('view-all-rooms');
    if (viewAllRoomsBtn) {
        viewAllRoomsBtn.addEventListener('click', function() {
            // 切换到聊天室管理页面
            document.querySelector('.nav-link[data-page="rooms"]').click();
        });
    }
}

// 绑定用户管理页面事件
function bindUserManagementEvents() {
    // 刷新用户列表
    const refreshBtn = document.getElementById('refresh-users');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadUsersData();
        });
    }
    
    // 添加用户按钮
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', function() {
            // 清空表单
            document.getElementById('user-edit-form').reset();
            document.getElementById('edit-user-id').value = '';
            document.getElementById('userModalLabel').textContent = '添加用户';
            // 显示模态框
            const userModal = new bootstrap.Modal(document.getElementById('userModal'));
            userModal.show();
        });
    }
}

// 绑定聊天室管理页面事件
function bindRoomManagementEvents() {
    // 刷新聊天室列表
    const refreshBtn = document.getElementById('refresh-rooms');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadRoomsData();
        });
    }
    
    // 添加聊天室按钮
    const addRoomBtn = document.getElementById('add-room-btn');
    if (addRoomBtn) {
        addRoomBtn.addEventListener('click', function() {
            alert('添加聊天室功能待实现');
        });
    }
}

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
            // 开始实时更新系统指标
            startRealTimeSystemMetrics();
            break;
        case 'users':
            loadUsersData();
            // 停止实时更新系统指标
            stopRealTimeSystemMetrics();
            break;
        case 'rooms':
            loadRoomsData();
            // 停止实时更新系统指标
            stopRealTimeSystemMetrics();
            break;
        case 'settings':
            loadSettingsData();
            // 停止实时更新系统指标
            stopRealTimeSystemMetrics();
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
        
        // 获取在线用户数和实时系统指标
        await updateRealTimeSystemMetrics();
        
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
                document.getElementById('uptime-info').textContent = sysInfo.uptime || '-';
            } else {
                document.getElementById('node-version').textContent = '未知';
                document.getElementById('os-info').textContent = '未知';
                document.getElementById('arch-info').textContent = '未知';
                document.getElementById('cpu-info').textContent = '未知';
                document.getElementById('total-mem-info').textContent = '未知';
                document.getElementById('free-mem-info').textContent = '未知';
                document.getElementById('uptime-info').textContent = '未知';
            }
        } catch (error) {
            document.getElementById('node-version').textContent = '获取失败';
            document.getElementById('os-info').textContent = '获取失败';
            document.getElementById('arch-info').textContent = '获取失败';
            document.getElementById('cpu-info').textContent = '获取失败';
            document.getElementById('total-mem-info').textContent = '获取失败';
            document.getElementById('free-mem-info').textContent = '获取失败';
            document.getElementById('uptime-info').textContent = '获取失败';
        }
        
        // 获取系统监控历史数据并更新图表
        try {
            const metricsHistoryResponse = await fetch('/api/system/metrics/history');
            if (metricsHistoryResponse.ok) {
                const metricsHistoryData = await metricsHistoryResponse.json();
                updateResourceCharts(metricsHistoryData.data);
            }
        } catch (error) {
            console.error('获取系统监控历史数据失败:', error);
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
                <td>${room.isPrivate ? '私人' : '公共'}</td>
                <td>${room.creatorName || room.creatorId}</td>
                <td>${room.memberCount}</td>
                <td>${new Date(room.createdAt).toLocaleString()}</td>
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
        
        // 获取并显示聊天室统计信息
        await loadRoomStatistics();
    } catch (error) {
        console.error('加载聊天室数据失败:', error);
    }
}

// 获取并显示聊天室统计信息
async function loadRoomStatistics() {
    try {
        const response = await fetch('/api/admin/rooms/statistics');
        const stats = await response.json();
        
        // 更新统计数据显示
        document.getElementById('total-public-rooms').textContent = stats.totalPublicRooms;
        document.getElementById('total-private-rooms').textContent = stats.totalPrivateRooms;
        document.getElementById('avg-members-per-room').textContent = stats.maxMembersInRoom;
        
        // 显示最活跃聊天室信息
        if (stats.mostActiveRoom) {
            document.getElementById('most-active-room').textContent = 
                `${stats.mostActiveRoom.name} (${stats.mostActiveRoom.messageCount} 条消息)`;
        } else {
            document.getElementById('most-active-room').textContent = '-';
        }
    } catch (error) {
        console.error('加载聊天室统计信息失败:', error);
        // 出错时显示默认值
        document.getElementById('total-public-rooms').textContent = '0';
        document.getElementById('total-private-rooms').textContent = '0';
        document.getElementById('avg-members-per-room').textContent = '0';
        document.getElementById('most-active-room').textContent = '-';
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
            document.getElementById('max-room-members').value = settings.data.maxRoomMembers || 1000;
            document.getElementById('allow-user-registration').checked = settings.data.allowUserRegistration !== false; // 默认为true
            document.getElementById('max-login-attempts').value = settings.data.maxLoginAttempts || 5;
            document.getElementById('login-lock-time').value = settings.data.loginLockTime || 120;
        }
        
        // 获取系统配置
        const configResponse = await fetch('/api/admin/config');
        const config = await configResponse.json();
        
        if (config.success) {
            document.getElementById('db-host').value = config.data.db?.host || '';
            document.getElementById('db-port').value = config.data.db?.port || '';
            document.getElementById('db-user').value = config.data.db?.user || '';
            document.getElementById('db-password').value = config.data.db?.password || '';
            document.getElementById('db-name').value = config.data.db?.database || '';
            document.getElementById('redis-host').value = config.data.redis?.host || '';
            document.getElementById('redis-port').value = config.data.redis?.port || '';
            document.getElementById('redis-password').value = config.data.redis?.password || '';
            document.getElementById('base-url').value = config.data.baseUrl || '';
            document.getElementById('server-port').value = config.data.port || '';
            document.getElementById('encryption-key').value = config.data.encryptionKey || '';
            document.getElementById('log-level').value = config.data.logLevel || 'INFO';
            document.getElementById('worker-threads').value = config.data.workerCount || '0';
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
            maxFileSize: parseInt(document.getElementById('max-file-size').value),
            maxRoomMembers: parseInt(document.getElementById('max-room-members').value),
            allowUserRegistration: document.getElementById('allow-user-registration').checked,
            maxLoginAttempts: parseInt(document.getElementById('max-login-attempts').value),
            loginLockTime: parseInt(document.getElementById('login-lock-time').value)
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
        
        // 验证必填字段
        if (!username || !nickname) {
            alert('用户名和昵称不能为空');
            return;
        }
        
        let response;
        if (userId) {
            // 编辑现有用户
            const userData = { username, nickname, status, isAdmin };
            if (password) {
                userData.password = password;
            }
            
            response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
        } else {
            // 添加新用户
            if (!password) {
                alert('密码不能为空');
                return;
            }
            
            const userData = { username, nickname, password, status, isAdmin };
            
            response = await fetch(`/api/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
        }
        
        if (response.ok) {
            alert(userId ? '用户信息更新成功' : '用户创建成功');
            const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
            modal.hide();
            loadUsersData(); // 重新加载用户列表
        } else {
            const result = await response.json();
            alert((userId ? '更新用户信息失败: ' : '创建用户失败: ') + result.error);
        }
    } catch (error) {
        console.error('保存用户信息失败:', error);
        alert('保存用户信息失败: ' + error.message);
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadPageData(currentPage);

    // 隐藏初始加载动画
    const loadingElement = document.getElementById('initialLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
});