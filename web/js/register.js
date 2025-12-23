document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const strengthMeterFill = document.querySelector('.strength-meter-fill');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const registerBtn = document.getElementById('registerBtn');
    const btnText = registerBtn.querySelector('.btn-text');
    const spinner = registerBtn.querySelector('.spinner-border');
    
    // 密码显示/隐藏切换
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    });
    
    toggleConfirmPassword.addEventListener('click', function() {
        const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        confirmPasswordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    });
    
    // 密码强度检测
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = calculatePasswordStrength(password);
        
        let strengthColor, strengthWidth;
        if (strength < 30) {
            strengthColor = '#dc3545'; // 红色 - 弱
            strengthWidth = '25%';
        } else if (strength < 60) {
            strengthColor = '#ffc107'; // 黄色 - 中
            strengthWidth = '50%';
        } else if (strength < 80) {
            strengthColor = '#20c997'; // 蓝色 - 强
            strengthWidth = '75%';
        } else {
            strengthColor = '#28a745'; // 绿色 - 很强
            strengthWidth = '100%';
        }
        
        strengthMeterFill.style.width = strengthWidth;
        strengthMeterFill.style.backgroundColor = strengthColor;
    });
    
    // 密码强度计算函数
    function calculatePasswordStrength(password) {
        let strength = 0;
        
        // 长度至少8位
        if (password.length >= 8) strength += 25;
        
        // 包含小写字母
        if (/[a-z]/.test(password)) strength += 15;
        
        // 包含大写字母
        if (/[A-Z]/.test(password)) strength += 15;
        
        // 包含数字
        if (/\d/.test(password)) strength += 15;
        
        // 包含特殊符号
        if (/[^a-zA-Z0-9]/.test(password)) strength += 30;
        
        return Math.min(strength, 100);
    }
    
    // 表单提交处理
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const formData = {
            username: document.getElementById('username').value,
            nickname: document.getElementById('nickname').value,
            password: document.getElementById('password').value,
            email: document.getElementById('email').value,
            mobile: document.getElementById('mobile').value
        };
        
        // 简单验证
        if (!validateForm(formData)) {
            return;
        }
        
        // 显示加载状态
        btnText.textContent = '注册中...';
        spinner.classList.remove('d-none');
        registerBtn.disabled = true;
        
        // 发送注册请求
        fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message && data.user_id) {
                // 注册成功 - 显示成功横幅
                showNotification(data.message, 'success');
                
                // 如果不需要邮箱验证，跳转到登录页
                if (!data.email_sent) {
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    // 如果需要邮箱验证，提示用户检查邮箱
                    showNotification('请检查邮箱完成验证', 'info');
                }
            } else {
                // 注册失败 - 显示错误横幅
                showNotification(data.error || '注册失败，请重试', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('网络错误，请重试', 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            btnText.textContent = '注册';
            spinner.classList.add('d-none');
            registerBtn.disabled = false;
        });
    });
    
    // 表单验证
    function validateForm(data) {
        // 验证用户名
        if (!data.username || data.username.length < 3 || data.username.length > 50) {
            showNotification('用户名长度必须在3-50个字符之间', 'error');
            return false;
        }
        
        // 验证昵称
        if (!data.nickname || data.nickname.length < 2 || data.nickname.length > 100) {
            showNotification('昵称长度必须在2-100个字符之间', 'error');
            return false;
        }
        
        // 验证邮箱
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            showNotification('请输入有效的邮箱地址', 'error');
            return false;
        }
        
        // 验证手机号（如果提供了）
        if (data.mobile && !/^1[3-9]\d{9}$/.test(data.mobile)) {
            showNotification('请输入有效的手机号', 'error');
            return false;
        }
        
        // 验证密码强度
        if (calculatePasswordStrength(data.password) < 80) {
            showNotification('密码强度不够，请使用包含大小写字母、数字和特殊符号的强密码', 'error');
            return false;
        }
        
        // 验证密码确认
        if (data.password !== document.getElementById('confirmPassword').value) {
            showNotification('两次输入的密码不一致', 'error');
            return false;
        }
        
        return true;
    }
    
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
        
        // 自动隐藏成功和信息通知
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv) {
                    const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                    bsAlert.close();
                }
            }, 5000);
        }
    }
});