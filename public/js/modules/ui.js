// UI交互模块

// 显示全局消息
export function showMessage(message, type = 'success', title = null) {
    const messageModal = document.getElementById('messageModal');
    const messageOverlay = document.getElementById('messageOverlay');
    const messageContent = document.getElementById('messageContent');
    const messageOK = document.getElementById('messageOK');
    const messageTitle = document.getElementById('messageTitle');
    
    if (messageModal && messageOverlay && messageContent) {
        // 设置消息内容
        messageContent.textContent = message;
        // 如果提供了自定义标题，则使用自定义标题，否则使用默认标题
        if (title) {
            messageTitle.textContent = title;
        } else {
            messageTitle.textContent = type === 'success' ? '成功' : type === 'danger' ? '错误' : '提示';
        }
        
        // 显示模态框和遮罩
        messageOverlay.style.display = 'flex';
        
        // 绑定确定按钮事件
        messageOK.onclick = function() {
            messageOverlay.style.display = 'none';
        };
    }
}

// 自定义确认框函数
export function showConfirm(message) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirmModal');
        const confirmOverlay = document.getElementById('confirmOverlay');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmOK = document.getElementById('confirmOK');
        const confirmCancel = document.getElementById('confirmCancel');
        
        if (confirmModal && confirmOverlay && confirmMessage) {
            // 设置确认消息
            confirmMessage.textContent = message;
            
            // 显示模态框和遮罩
            confirmOverlay.style.display = 'flex';
            
            // 确定按钮事件
            confirmOK.onclick = function() {
                confirmOverlay.style.display = 'none';
                resolve(true);
            };
            
            // 取消按钮事件
            confirmCancel.onclick = function() {
                confirmOverlay.style.display = 'none';
                resolve(false);
            };
        } else {
            // 如果模态框不存在，使用默认的confirm
            resolve(confirm(message));
        }
    });
}

// 切换到注册表单
export function showRegisterForm() {
    const loginContainer = document.getElementById('loginContainer');
    const registerContainer = document.getElementById('registerContainer');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'block';
}

// 切换到登录表单
export function showLoginForm() {
    const registerContainer = document.getElementById('registerContainer');
    const loginContainer = document.getElementById('loginContainer');
    
    if (registerContainer) registerContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'block';
}

// 打开个人中心弹窗
export function openProfilePopup() {
    const profilePopup = document.getElementById('profilePopup');
    const overlay = document.getElementById('overlay');
    
    if (profilePopup) profilePopup.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // 同步用户信息到弹窗
    const userNickname = document.getElementById('userNickname');
    const userUsername = document.getElementById('userUsername');
    const popupNickname = document.getElementById('popupNickname');
    const popupUsername = document.getElementById('popupUsername');
    const popupUid = document.getElementById('popupUid');
    const currentAvatar = document.getElementById('currentAvatar');
    const userAvatar = document.getElementById('userAvatar');
    
    if (popupNickname && userNickname) popupNickname.value = userNickname.textContent;
    if (popupUsername && userUsername) popupUsername.value = userUsername.textContent;
    if (popupUid) popupUid.value = localStorage.getItem('userId');
    if (currentAvatar && userAvatar) currentAvatar.src = userAvatar.src;
}

// 关闭个人中心弹窗
export function closeProfilePopup() {
    const profilePopup = document.getElementById('profilePopup');
    const overlay = document.getElementById('overlay');
    
    if (profilePopup) profilePopup.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}