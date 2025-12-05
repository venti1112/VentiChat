// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileForm } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory, loadRooms, bindRoomButtons, joinRoom } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, uploadLargeFile, sendFileMessage } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';
import { playVideoInFullscreen } from './modules/videoPlayer.js';
import { imageViewerInstance } from './modules/imageViewer.js';

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
window.loadRooms = loadRooms;
window.joinRoom = joinRoom;
window.initializeWebSocket = initializeWebSocket;
window.updateUnreadCount = updateUnreadCount;
window.updateRoomUnreadCount = updateRoomUnreadCount;
window.handleFileSelect = handleFileSelect;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;
window.playVideoInFullscreen = playVideoInFullscreen;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 隐藏加载动画
    const loadingElement = document.getElementById('initialLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }

    // 检查登录状态
    checkLoginStatus();
    
    // 绑定个人资料表单
    bindProfileForm();
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 页面加载完成后加载聊天室列表
    const chatSection = document.getElementById('chatSection');
    if (chatSection && chatSection.style.display !== 'none') {
        // 如果聊天界面已显示，则加载聊天室列表
        loadRooms();
    }
    
    // 绑定聊天室相关按钮事件
    bindRoomButtons();
});