// 当前步骤
let currentStep = 1;

// 下一步
function nextStep(step) {
    document.getElementById(`step${step}`).classList.add('d-none');
    document.getElementById(`step${step}-indicator`).classList.remove('active');
    document.getElementById(`step${step}-indicator`).classList.add('completed');
    
    currentStep = step + 1;
    document.getElementById(`step${currentStep}`).classList.remove('d-none');
    document.getElementById(`step${currentStep}-indicator`).classList.add('active');
    
    // 如果是最后一步，更新预览
    if (currentStep === 8) {
        updatePreview();
    }
}

// 上一步
function prevStep(step) {
    document.getElementById(`step${step}`).classList.add('d-none');
    document.getElementById(`step${step}-indicator`).classList.remove('active');
    
    currentStep = step - 1;
    document.getElementById(`step${currentStep}`).classList.remove('d-none');
    document.getElementById(`step${currentStep}-indicator`).classList.add('active');
    document.getElementById(`step${currentStep}-indicator`).classList.remove('completed');
}

// 检查密码强度
function checkPasswordStrength() {
    const password = document.getElementById('admin_password').value;
    
    // 检查各项要求
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // 更新UI显示
    document.getElementById('length').className = hasLength ? 'requirement valid' : 'requirement';
    document.getElementById('uppercase').className = hasUppercase ? 'requirement valid' : 'requirement';
    document.getElementById('lowercase').className = hasLowercase ? 'requirement valid' : 'requirement';
    document.getElementById('number').className = hasNumber ? 'requirement valid' : 'requirement';
    document.getElementById('special').className = hasSpecial ? 'requirement valid' : 'requirement';
}

// 验证管理员账户信息
function validateAdminAccount() {
    const password = document.getElementById('admin_password').value;
    const confirmPassword = document.getElementById('admin_password_confirm').value;
    
    // 检查密码强度
    const hasLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        alert('密码必须满足所有要求：至少8个字符，包含大写字母、小写字母、数字和特殊符号！');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('两次输入的密码不一致，请重新输入！');
        return;
    }
    
    nextStep(7);
}

// 更新预览信息
function updatePreview() {
    // 服务器配置预览
    document.getElementById('preview-server-host').textContent = document.getElementById('server_host').value;
    document.getElementById('preview-server-port').textContent = document.getElementById('server_port').value;
    document.getElementById('preview-server-level').textContent = document.getElementById('server_level').value;
    document.getElementById('preview-server-name').textContent = document.getElementById('server_name').value;
    
    // 数据库配置预览
    document.getElementById('preview-db-host').textContent = document.getElementById('db_host').value;
    document.getElementById('preview-db-port').textContent = document.getElementById('db_port').value;
    document.getElementById('preview-db-user').textContent = document.getElementById('db_user').value;
    document.getElementById('preview-db-name').textContent = document.getElementById('db_name').value;
    
    // Redis配置预览
    document.getElementById('preview-redis-host').textContent = document.getElementById('redis_host').value;
    document.getElementById('preview-redis-port').textContent = document.getElementById('redis_port').value;
    
    // 邮件配置预览
    document.getElementById('preview-email-host').textContent = document.getElementById('email_host').value;
    document.getElementById('preview-email-port').textContent = document.getElementById('email_port').value;
    document.getElementById('preview-email-user').textContent = document.getElementById('email_user').value;
    document.getElementById('preview-email-from').textContent = document.getElementById('email_from').value;
    document.getElementById('preview-email-secure').textContent = document.getElementById('email_secure').checked ? '是' : '否';
    
    // 管理员账户预览
    document.getElementById('preview-admin-username').textContent = document.getElementById('admin_username').value;
    document.getElementById('preview-admin-nickname').textContent = document.getElementById('admin_nickname').value;
    document.getElementById('preview-admin-email').textContent = document.getElementById('admin_email').value;
}

// 测试MySQL连接
function testMySQLConnection() {
    const host = document.getElementById('db_host').value;
    const port = document.getElementById('db_port').value;
    const user = document.getElementById('db_user').value;
    const password = document.getElementById('db_password').value;
    const database = document.getElementById('db_name').value;
    
    const testResult = document.getElementById('mysql-test-result');
    testResult.innerHTML = '<span class="text-info"><i class="bi bi-hourglass-split me-1"></i>测试中...</span>';
    
    // 发送测试请求
    fetch('/test-mysql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            host: host,
            port: port,
            user: user,
            password: password,
            database: database
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            testResult.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>连接成功</span>';
        } else {
            testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + data.error + '</span>';
        }
    })
    .catch(error => {
        testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + error.message + '</span>';
    });
}

// 测试Redis连接
function testRedisConnection() {
    const host = document.getElementById('redis_host').value;
    const port = document.getElementById('redis_port').value;
    const password = document.getElementById('redis_password').value;
    
    const testResult = document.getElementById('redis-test-result');
    testResult.innerHTML = '<span class="text-info"><i class="bi bi-hourglass-split me-1"></i>测试中...</span>';
    
    // 发送测试请求
    fetch('/test-redis', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            host: host,
            port: port,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            testResult.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>连接成功</span>';
        } else {
            testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + data.error + '</span>';
        }
    })
    .catch(error => {
        testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + error.message + '</span>';
    });
}

// 测试邮件连接
function testEmailConnection() {
    const host = document.getElementById('email_host').value;
    const port = document.getElementById('email_port').value;
    const user = document.getElementById('email_user').value;
    const password = document.getElementById('email_password').value;
    const secure = document.getElementById('email_secure').checked;
    
    const testResult = document.getElementById('email-test-result');
    testResult.innerHTML = '<span class="text-info"><i class="bi bi-hourglass-split me-1"></i>测试中...</span>';
    
    // 发送测试请求
    fetch('/test-email-connection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            host: host,
            port: port,
            user: user,
            password: password,
            secure: secure
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            testResult.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>连接成功</span>';
        } else {
            testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + data.error + '</span>';
        }
    })
    .catch(error => {
        testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>连接失败: ' + error.message + '</span>';
    });
}

// 发送测试邮件
function testSendEmail() {
    const host = document.getElementById('email_host').value;
    const port = document.getElementById('email_port').value;
    const user = document.getElementById('email_user').value;
    const password = document.getElementById('email_password').value;
    const from = document.getElementById('email_from').value;
    const secure = document.getElementById('email_secure').checked;
    const testAddress = document.getElementById('test_email_address').value;
    
    // 检查必要参数
    if (!testAddress) {
        alert('请输入测试邮箱地址');
        return;
    }
    
    const testResult = document.getElementById('email-test-result');
    testResult.innerHTML = '<span class="text-info"><i class="bi bi-hourglass-split me-1"></i>发送中...</span>';
    
    // 发送测试请求
    fetch('/test-send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            host: host,
            port: port,
            user: user,
            password: password,
            from: from,
            secure: secure,
            testAddress: testAddress
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            testResult.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>邮件发送成功</span>';
        } else {
            testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>邮件发送失败: ' + data.error + '</span>';
        }
    })
    .catch(error => {
        testResult.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>邮件发送失败: ' + error.message + '</span>';
    });
}

// 开始安装
function startInstallation() {
    // 显示初始化界面
    document.getElementById(`step${currentStep}`).classList.add('d-none');
    document.getElementById('initializing').classList.remove('d-none');
    
    // 收集表单数据
    const formData = new FormData(document.getElementById('setup-form'));
    
    // 发送安装请求
    fetch('/setup', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('安装失败: ' + data.error);
            // 返回到确认页面
            document.getElementById('initializing').classList.add('d-none');
            document.getElementById(`step${currentStep}`).classList.remove('d-none');
        } else {
            // 显示成功页面
            setTimeout(() => {
                document.getElementById('initializing').classList.add('d-none');
                document.getElementById('success').classList.remove('d-none');
            }, 1000);
        }
    })
    .catch(error => {
        alert('安装过程中发生错误: ' + error.message);
        // 返回到确认页面
        document.getElementById('initializing').classList.add('d-none');
        document.getElementById(`step${currentStep}`).classList.remove('d-none');
    });
}