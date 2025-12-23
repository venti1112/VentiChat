document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner-border');
    
    // 密码显示/隐藏切换
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    });
    
    // 表单提交处理
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const formData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };
        
        // 显示加载状态
        btnText.textContent = '登录中...';
        spinner.classList.remove('d-none');
        loginBtn.disabled = true;
        
        // 发送登录请求
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                // 登录成功，保存token到localStorage
                localStorage.setItem('token', data.token);
                
                // 显示成功通知
                showNotification('登录成功！', 'success');
                
                // 延迟跳转到主页
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                // 检查是否是邮箱未验证错误
                if (data.error && data.error.includes('邮箱未验证')) {
                    // 显示特殊通知，提供重发验证入口
                    showNotificationWithResend(data.error);
                } else {
                    // 登录失败 - 显示错误通知
                    showNotification(data.error || '登录失败，请重试', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('网络错误，请重试', 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            btnText.textContent = '登录';
            spinner.classList.add('d-none');
            loginBtn.disabled = false;
        });
    });
    
    // 显示通知横幅
    function showNotification(message, type) {
        // 获取通知容器
        const notificationContainer = document.getElementById('notificationContainer');
        
        // 清空通知容器
        notificationContainer.innerHTML = '';
        
        // 创建新的通知横幅
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', 'alert-dismissible', 'fade', 'show');
        
        // 根据类型设置样式
        switch(type) {
            case 'success':
                alertDiv.classList.add('alert-success');
                break;
            case 'error':
                alertDiv.classList.add('alert-danger');
                break;
            case 'info':
                alertDiv.classList.add('alert-info');
                break;
            case 'warning':
                alertDiv.classList.add('alert-warning');
                break;
        }
        
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // 将通知横幅添加到容器中
        notificationContainer.appendChild(alertDiv);
        
        // 自动隐藏成功通知
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv) {
                    const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                    bsAlert.close();
                }
            }, 5000);
        }
    }
    
    // 显示带重发验证入口的通知
    function showNotificationWithResend(message) {
        // 获取通知容器
        const notificationContainer = document.getElementById('notificationContainer');
        
        // 清空通知容器
        notificationContainer.innerHTML = '';
        
        // 创建新的通知横幅
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', 'alert-warning', 'alert-dismissible', 'fade', 'show');
        
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            <div>
                <div>${message}</div>
                <div class="mt-2">
                    <a href="/resend-verification" class="btn btn-sm btn-outline-primary">重发验证邮件</a>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // 将通知横幅添加到容器中
        notificationContainer.appendChild(alertDiv);
    }
});