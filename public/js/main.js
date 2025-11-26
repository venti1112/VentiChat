// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileForm } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, uploadLargeFile, sendFileMessage } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';

// 将函数暴露到全局作用域，以便HTML可以直接调用
window.showMessage = showMessage;
window.showConfirm = showConfirm;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.openProfilePopup = openProfilePopup;
window.closeProfilePopup = closeProfilePopup;
window.updateProfile = updateProfile;
window.applyUserPreferences = applyUserPreferences;
window.displayMessages = displayMessages;
window.renderMessage = renderMessage;
window.getUserInfoById = getUserInfoById;
window.displayRooms = displayRooms;
window.enterRoom = enterRoom;
window.loadMessageHistory = loadMessageHistory;
window.initializeWebSocket = initializeWebSocket;
window.updateUnreadCount = updateUnreadCount;
window.updateRoomUnreadCount = updateRoomUnreadCount;
window.handleFileSelect = handleFileSelect;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    checkLoginStatus();
    
    // 绑定个人资料表单
    bindProfileForm();
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 加载聊天室列表
    function loadRooms() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('未登录，无法加载聊天室列表');
            return;
        }
        
        fetch('/api/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('加载聊天室列表失败');
            }
            return response.json();
        })
        .then(rooms => {
            displayRooms(rooms);
        })
        .catch(error => {
            console.error('加载聊天室列表错误:', error);
            showMessage('加载聊天室列表失败: ' + error.message, 'danger');
        });
    }
    
    // 将loadRooms函数暴露到全局作用域
    window.loadRooms = loadRooms;
    
    // 页面加载完成后加载聊天室列表
    const chatSection = document.getElementById('chatSection');
    if (chatSection && chatSection.style.display !== 'none') {
        // 如果聊天界面已显示，则加载聊天室列表
        loadRooms();
    }
});