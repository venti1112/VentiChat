// 当前活动页面
let currentPage = 'dashboard';
let combinedChart = null;
let systemMetricsInterval = null; // 用于定期更新系统指标
let systemBootTime = null; // 系统启动时间
let uptimeInterval = null; // 用于每秒更新运行时间

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
    
    // 停止更新运行时间
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
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
        
        // 只在首次加载时获取系统启动时间，之后不再请求该接口
        if (!systemBootTime) {
            // 获取系统信息以获取启动时间
            try {
                const sysInfoResponse = await fetch('/api/system/info');
                if (sysInfoResponse.ok) {
                    const sysInfo = await sysInfoResponse.json();
                    // 存储系统启动时间戳
                    systemBootTime = new Date(sysInfo.bootTime).getTime();
                    // 开始运行时间计数器
                    startUptimeCounter();
                }
            } catch (error) {
                console.error('获取系统信息失败:', error);
            }
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
    
    // 更新内存详情信息
    if (metrics.memoryDetails) {
        document.getElementById('current-memory-used').textContent = metrics.memoryDetails.active + ' MB';
        document.getElementById('current-memory-available').textContent = metrics.memoryDetails.available + ' MB';
        document.getElementById('current-memory-total').textContent = metrics.memoryDetails.total + ' MB';
    }
}

// 使用最新数据更新资源图表
function updateResourceChartsWithLatest(latestMetrics) {
    if (!combinedChart) return;
    
    // 添加新的时间标签
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    combinedChart.data.labels.push(timeLabel);
    
    // 添加新的数据点
    combinedChart.data.datasets[0].data.push(latestMetrics.cpu);
    combinedChart.data.datasets[1].data.push(latestMetrics.memory);
    combinedChart.data.datasets[2].data.push(latestMetrics.network.received);
    combinedChart.data.datasets[3].data.push(latestMetrics.network.transmitted);
    combinedChart.data.datasets[4].data.push(latestMetrics.diskIO.read);
    combinedChart.data.datasets[5].data.push(latestMetrics.diskIO.write);
    
    // 添加内存详细信息到图表实例
    if (!combinedChart.memoryDetails) {
        combinedChart.memoryDetails = [];
    }
    combinedChart.memoryDetails.push(latestMetrics.memoryDetails || {
        total: 0,
        active: 0,
        available: 0
    });
    
    combinedChart.update();
}

// 开始运行时间计数器
function startUptimeCounter() {
    // 如果已经有定时器在运行，则先清除
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
    }
    
    // 每秒更新一次运行时间
    uptimeInterval = setInterval(() => {
        if (systemBootTime) {
            const now = new Date().getTime();
            const uptimeMs = now - systemBootTime;
            document.getElementById('uptime-info').textContent = formatDuration(uptimeMs);
        }
    }, 1000);
}

// 格式化持续时间（毫秒）为易读的字符串
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
        return `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;
    } else if (hours > 0) {
        return `${hours}小时 ${minutes}分钟 ${seconds}秒`;
    } else if (minutes > 0) {
        return `${minutes}分钟 ${seconds}秒`;
    } else {
        return `${seconds}秒`;
    }
}

// 初始化仪表盘图表
function initDashboardCharts() {
    const ctx = document.getElementById('combinedChart').getContext('2d');
    combinedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPU使用率 (%)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: '内存使用率 (%)',
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: '网络接收 (KB/s)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                },
                {
                    label: '网络发送 (KB/s)',
                    data: [],
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                },
                {
                    label: '磁盘读取 (KB/s)',
                    data: [],
                    borderColor: 'rgb(255, 159, 64)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                },
                {
                    label: '磁盘写入 (KB/s)',
                    data: [],
                    borderColor: 'rgb(255, 205, 86)',
                    backgroundColor: 'rgba(255, 205, 86, 0.2)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'CPU/内存 (%)'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '网络/磁盘 (KB/s)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            // 为CPU和内存数据添加额外的详细信息
                            if (context.datasetIndex === 1 && combinedChart.memoryDetails) {
                                const memDetail = combinedChart.memoryDetails[context.dataIndex];
                                if (memDetail) {
                                    return [
                                        `已用内存: ${memDetail.active} MB`,
                                        `可用内存: ${memDetail.available} MB`
                                    ];
                                }
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
    // 初始化memoryDetails数组
    combinedChart.memoryDetails = [];
}

// 更新系统资源图表
function updateResourceCharts(metricsHistory) {
    if (!combinedChart) return;
    
    // 获取当前选择的时间段
    const combinedPeriodElement = document.getElementById('combinedPeriodDropdown');
    
    // 获取时间段文本内容并转换为标准格式
    let period = '12h'; // 默认值
    
    if (combinedPeriodElement) {
        const text = combinedPeriodElement.textContent.trim();
        switch(text) {
            case '最近30分钟':
                period = '30m';
                break;
            case '最近1小时':
                period = '1h';
                break;
            case '最近3小时':
                period = '3h';
                break;
            case '最近6小时':
                period = '6h';
                break;
            case '最近12小时':
                period = '12h';
                break;
        }
    }
    
    // 获取当前时间
    const now = new Date();
    
    // 根据选择的周期计算时间范围
    let timeAgo;
    switch(period) {
        case '30m':
            timeAgo = new Date(now.getTime() - 30 * 60 * 1000);
            break;
        case '1h':
            timeAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
            break;
        case '3h':
            timeAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
            break;
        case '6h':
            timeAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
        case '24h':
            timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default: // 12h
            timeAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    }
    
    // 过滤出指定时间范围内的数据
    const recentMetrics = metricsHistory.filter(point => new Date(point.timestamp) >= timeAgo);
    
    // 使用过滤后的数据（即使为空也正常显示）
    const dataToUse = recentMetrics;
    
    // 准备数据
    const labels = dataToUse.map(point => {
        const date = new Date(point.timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    });
    
    const cpuData = dataToUse.map(point => point.cpu);
    const memoryData = dataToUse.map(point => point.memory);
    // 提取内存详细信息
    const memoryDetails = dataToUse.map(point => point.memoryDetails || {
        total: 0,
        active: 0,
        available: 0
    });
    
    const networkReceivedData = dataToUse.map(point => point.network.received);
    const networkTransmittedData = dataToUse.map(point => point.network.transmitted);
    const diskReadData = dataToUse.map(point => point.diskIO.read);
    const diskWriteData = dataToUse.map(point => point.diskIO.write);
    
    // 更新图表
    combinedChart.data.labels = labels;
    combinedChart.data.datasets[0].data = cpuData;
    combinedChart.data.datasets[1].data = memoryData;
    combinedChart.data.datasets[2].data = networkReceivedData;
    combinedChart.data.datasets[3].data = networkTransmittedData;
    combinedChart.data.datasets[4].data = diskReadData;
    combinedChart.data.datasets[5].data = diskWriteData;
    
    // 附加内存详细信息到图表对象
    combinedChart.memoryDetails = memoryDetails;
    combinedChart.update();
}

// 绑定周期选择下拉菜单事件
function bindPeriodDropdownEvents() {
    // 合并后的图表周期选择
    document.querySelectorAll('#combinedPeriodDropdown + .dropdown-menu .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('combinedPeriodDropdown').textContent = this.textContent;
            // 重新加载仪表盘数据
            loadDashboardData();
        });
    });
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
        
        // 获取在线用户数（暂时显示为0，后续需要实现WebSocket连接统计）
        // 这里将通过系统监控API获取实际数据
        try {
            const metricsResponse = await fetch('/api/system/metrics');
            if (metricsResponse.ok) {
                const metricsData = await metricsResponse.json();
                document.getElementById('online-users').textContent = metricsData.data.onlineUsers || 0;
                
                // 更新当前指标显示
                updateCurrentMetrics(metricsData.data);
            } else {
                document.getElementById('online-users').textContent = '0';
            }
        } catch (error) {
            document.getElementById('online-users').textContent = '0';
        }
        
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
                
                // 获取系统启动时间
                systemBootTime = sysInfo.bootTime;
                
                // 启动每秒更新运行时间的定时器
                if (uptimeInterval) {
                    clearInterval(uptimeInterval);
                }
                
                uptimeInterval = setInterval(() => {
                    if (systemBootTime) {
                        const uptimeSeconds = Math.floor((Date.now() - systemBootTime) / 1000);
                        document.getElementById('uptime-info').textContent = formatUptime(uptimeSeconds);
                    }
                }, 1000);
            } else {
                document.getElementById('node-version').textContent = '未知';
                document.getElementById('os-info').textContent = '未知';
                document.getElementById('arch-info').textContent = '未知';
                document.getElementById('cpu-info').textContent = '未知';
                document.getElementById('total-mem-info').textContent = '未知';
                document.getElementById('uptime-info').textContent = '未知';
            }
        } catch (error) {
            document.getElementById('node-version').textContent = '获取失败';
            document.getElementById('os-info').textContent = '获取失败';
            document.getElementById('arch-info').textContent = '获取失败';
            document.getElementById('cpu-info').textContent = '获取失败';
            document.getElementById('total-mem-info').textContent = '获取失败';
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

// 将秒数转换为易读的格式
function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= 24 * 3600;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}天${hours}小时${minutes}分钟${seconds}秒`;
    } else if (hours > 0) {
        return `${hours}小时${minutes}分钟${seconds}秒`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds}秒`;
    } else {
        return `${seconds}秒`;
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
                <td>${user.isAdmin ? '管理员' : '普通用户'}</td>
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
    // 根据用户状态返回对应的中文文本
    switch(status) {
        case 'active':
            return '正常';
        case 'banned':
            return '封禁';
        default:
            return '未知';
    }
}

// 打开编辑用户模态框
async function openEditUserModal(userId) {
    try {
        // 获取用户详细信息
        const response = await fetch(`/api/admin/users/${userId}`);
        if (!response.ok) {
            throw new Error('获取用户信息失败');
        }
        
        const user = await response.json();
        
        // 填充表单数据
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-nickname').value = user.nickname;
        document.getElementById('edit-status').value = user.status;
        document.getElementById('edit-is-admin').checked = user.isAdmin || false;
        
        // 更新模态框标题
        document.getElementById('userModalLabel').textContent = '编辑用户';
        
        // 清空密码字段
        document.getElementById('edit-password').value = '';
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    } catch (error) {
        console.error('打开编辑用户模态框失败:', error);
        alert('获取用户信息失败: ' + error.message);
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
            // 将字节转换为MB
            document.getElementById('max-file-size').value = settings.data.maxFileSize ? Math.round(settings.data.maxFileSize / (1024 * 1024)) : 10;
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
        // 将MB转换为字节
        const maxFileSizeMB = parseInt(document.getElementById('max-file-size').value);
        const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
        
        const settings = {
            siteName: document.getElementById('site-name').value,
            messageRetentionDays: parseInt(document.getElementById('message-retention-days').value),
            maxFileSize: maxFileSizeBytes,
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