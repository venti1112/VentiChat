document.addEventListener('DOMContentLoaded', function() {
    // 从URL中获取token参数
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        showNotification('验证链接无效或已过期', 'error');
        document.getElementById('verifyContainer').innerHTML = '<p class="text-center text-danger">验证链接无效或已过期</p>';
        return;
    }
    
    // 发送验证请求
    fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: token })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            document.getElementById('verifyContainer').innerHTML = `
                <div class="text-center">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                    <h3 class="mt-3 text-success">验证成功</h3>
                    <p>${data.message}</p>
                </div>
            `;
            showNotification(data.message, 'success');
        } else {
            document.getElementById('verifyContainer').innerHTML = `
                <div class="text-center">
                    <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 3rem;"></i>
                    <h3 class="mt-3 text-danger">验证失败</h3>
                    <p>${data.error || '验证失败，请重试'}</p>
                </div>
            `;
            showNotification(data.error || '验证失败，请重试', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('verifyContainer').innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 3rem;"></i>
                <h3 class="mt-3 text-danger">网络错误</h3>
                <p>网络请求失败，请检查网络连接后重试</p>
            </div>
        `;
        showNotification('网络错误，请重试', 'error');
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
});