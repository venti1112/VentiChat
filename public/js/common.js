/*
 * 公共JavaScript - 在多个页面中共享的功能
 */

// 显示成功消息
textContent = message;
            msgDiv.style.display = 'block';
            
            setTimeout(() => {
                msgDiv.style.display = 'none';
            }, 3000);
        }
        
        // 显示错误消息
        function showError(message) {
            const msgDiv = document.getElementById('globalMessage');
            msgDiv.className = 'alert alert-danger fixed-top text-center';
            msgDiv.textContent = message;
            msgDiv.style.display = 'block';
            
            setTimeout(() => {
                msgDiv.style.display = 'none';
            }, 5000);
        }

        // 检查登录状态和权限
        function checkAuth(needAdmin = false) {
            const token = localStorage.getItem('authToken');
            const currentUser = localStorage.getItem('currentUser');
            
            if (!token || !currentUser) {
                window.location.href = '/login.html';
                return false;
            }
            
            try {
                // 验证token有效性（简单检查）
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/login.html';
                    return false;
                }
                
                // 如果需要管理员权限，检查用户角色
                if (needAdmin) {
                    const user = JSON.parse(currentUser);
                    if (!user.isAdmin) {
                        alert('您没有访问管理后台的权限');
                        window.location.href = '/';
                        return false;
                    }
                }
                
                return true;
            } catch (e) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                window.location.href = '/login.html';
                return false;
            }
        }

        // 格式化日期时间显示
        function formatDateTime(dateTimeStr) {
            const date = new Date(dateTimeStr);
            return date.toLocaleString();
        }

        // 格式化时间显示（相对时间）
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return '刚刚';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
            if (diff < 86400000 && date.getDate() === now.getDate()) return `${Math.floor(diff / 3600000)}小时前`;
            
            return date.toLocaleString();
        }