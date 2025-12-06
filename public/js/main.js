// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileForm } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById, clearDisplayedMessages } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory, loadRooms, bindRoomButtons } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, uploadLargeFile, sendFileMessage } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';
import { playVideoInFullscreen } from './modules/videoPlayer.js';
import { imageViewerInstance } from './modules/imageViewer.js';
import { initializeRoomSettings, handleJoinRequest } from './modules/roomSettings.js';

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
window.initializeWebSocket = initializeWebSocket;
window.updateUnreadCount = updateUnreadCount;
window.updateRoomUnreadCount = updateRoomUnreadCount;
window.handleFileSelect = handleFileSelect;
window.uploadFile = uploadFile;
window.uploadLargeFile = uploadLargeFile;
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;
window.playVideoInFullscreen = playVideoInFullscreen;
window.imageViewerInstance = imageViewerInstance;

/**
 * 隐藏初始加载动画
 */
function hideInitialLoading() {
    const loadingElement = document.getElementById('initialLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * 显示登录模态框
 */
function showLoginModal() {
    showLoginForm();
}

/**
 * 初始化所有模块
 */
async function initializeModules() {
    // 绑定个人资料表单
    bindProfileForm();
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 绑定表单事件
    bindFormEvents();
    
    // 绑定聊天室相关按钮事件
    bindRoomButtons();
    
    // 初始化房间设置模块
    initializeRoomSettings();
    
    // 应用用户偏好设置
    try {
        const preferences = await getUserPreferences();
        applyUserPreferences(preferences);
    } catch (error) {
        console.warn('获取用户偏好设置失败:', error);
        // 即使获取失败也应用默认设置
        applyUserPreferences();
    }
}

/**
 * 绑定初始事件
 */
function bindInitialEvents() {
    // 检查登录状态
    checkLoginStatus();
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing application...');
    
    try {
        // 初始化所有模块
        initializeModules();
        
        // 检查登录状态
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
            console.log('User logged in, initializing with token');
            // 用户已登录，初始化WebSocket连接
            window.initializeWebSocket(token);
            
            // 加载聊天室列表
            await loadRooms();
        } else {
            console.log('User not logged in, showing login modal');
            // 用户未登录，显示登录模态框
            showLoginModal();
        }
        
        // 绑定初始事件
        bindInitialEvents();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        window.showMessage('应用初始化失败: ' + error.message, 'danger');
    } finally {
        // 隐藏初始加载动画
        hideInitialLoading();
    }
});