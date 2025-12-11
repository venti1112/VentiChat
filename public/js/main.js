// 模块化主入口文件
import { showMessage, showConfirm, showRegisterForm, showLoginForm, openProfilePopup, closeProfilePopup } from './modules/ui.js';
import { checkLoginStatus, bindFormEvents, getUserPreferences, applyUserPreferences } from './modules/auth.js';
import { updateProfile, bindProfileFormEvents } from './modules/profile.js';
import { displayMessages, renderMessage, getUserInfoById, clearDisplayedMessages } from './modules/messageHandler.js';
import { displayRooms, enterRoom, loadMessageHistory, loadRooms, bindRoomButtons } from './modules/roomManager.js';
import { initializeWebSocket, updateUnreadCount, updateRoomUnreadCount } from './modules/websocket.js';
import { handleFileSelect, uploadFile, sendFileMessage, bindFileUploadEvents } from './modules/fileUpload.js';
import { sendMessage, bindSendMessageEvents } from './modules/messageSender.js';
import { playVideoInFullscreen } from './modules/videoPlayer.js';
import { imageViewerInstance } from './modules/imageViewer.js';
import { initializeRoomSettings } from './modules/roomSettings.js';
import { playNewMessageSound } from './modules/messageHandler.js';

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
window.sendFileMessage = sendFileMessage;
window.sendMessage = sendMessage;
window.playVideoInFullscreen = playVideoInFullscreen;
window.imageViewerInstance = imageViewerInstance;
window.playNewMessageSound = playNewMessageSound;

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
    bindProfileFormEvents();
    
    // 注意：不在这里调用bindFormEvents，避免重复绑定
    // bindFormEvents(); 
    
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
    
    // 绑定发送消息事件
    bindSendMessageEvents();
    
    // 绑定文件上传事件
    bindFileUploadEvents();
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async function() {
    // console.log('应用加载完成！正在初始化');
    
    try {
        // 初始化所有模块
        initializeModules();
        
        // 检查登录状态
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
            // console.log('用户已登录');
            // 用户已登录，初始化WebSocket连接
            window.initializeWebSocket(token);
            
            // 加载聊天室列表
            await loadRooms();
        } else {
            // console.log('用户未登录');
            // 用户未登录，显示登录模态框
            showLoginModal();
        }
        
        // 绑定初始事件
        bindInitialEvents();
        
        // console.log('应用初始化成功！');
    } catch (error) {
        console.error('应用初始化失败:', error);
        window.showMessage('应用初始化失败: ' + error.message, 'danger');
    } finally {
        // 隐藏初始加载动画
        hideInitialLoading();
    }
});

// 存储所有接收到的消息
let allMessages = [];

// 申请加入房间函数已在roomManager.js中定义，此处移除重复定义以避免冲突
async function requestToJoinRoom(roomId, message = '') {
    // console.log('申请加入房间:', roomId); // 添加调试日志

    try {
        // console.log('发送请求到: ', `/api/rooms/${roomId}/join`); // 添加调试日志
        const url = new URL(`/api/rooms/${roomId}/join`, window.location.origin);
        if (message) {
            url.searchParams.append('message', message);
        }
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin'
        });
        
        // console.log('收到响应:', response); // 添加调试日志
        const data = await response.json();
        // console.log('响应数据:', data); // 添加调试日志
        
        if (response.ok) {
            // 直接显示服务器返回的消息
            showMessage(data.message, 'success');
            
            // 如果是直接加入房间的情况，刷新房间列表
            if (data.joined === true) {
                loadRooms();
            }
        } else {
            showMessage(data.error || data.message || '发送加入请求失败', 'danger');
        }
    } catch (error) {
        console.error('发送加入请求失败:', error);
        showMessage('发送加入请求失败: ' + error.message, 'danger');
    }
}
