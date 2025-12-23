document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('resendForm');
    const identifierInput = document.getElementById('identifier');
    const passwordInput = document.getElementById('password');
    const newEmailInput = document.getElementById('newEmail');
    const resendBtn = document.getElementById('resendBtn');
    const btnText = resendBtn.querySelector('.btn-text');
    const spinner = resendBtn.querySelector('.spinner-border');
    
    // 表单提交处理
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const formData = {
            identifier: identifierInput.value,
            password: passwordInput.value,
            new_email: newEmailInput.value
        };
        
        // 显示加载状态
        btnText.textContent = '发送中...';
        spinner.classList.remove('d-none');
        resendBtn.disabled = true;
        
        // 发送重发验证请求
        fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // 成功 - 显示成功横幅
                showNotification(data.message, 'success');
            } else {
                // 失败 - 显示错误横幅
                showNotification(data.error || '发送失败，请重试', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('网络错误，请重试', 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            btnText.textContent = '发送验证邮件';
            spinner.classList.add('d-none');
            resendBtn.disabled = false;
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
});