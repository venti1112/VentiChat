// roomSettings.js - 处理房间设置和审批请求功能

import { showMessage } from './ui.js';
import { loadPendingRequests, displayPendingRequests, handleJoinRequest } from './roomManager.js';

let currentRoomId = null;
let isInitialized = false;

/**
 * 初始化房间设置模块
 */
export function initializeRoomSettings() {
    if (isInitialized) return;
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const roomId = localStorage.getItem('currentRoomId');
            if (roomId) {
                showRoomSettings(roomId);
            } else {
                showMessage('请先选择一个聊天室', 'warning');
            }
        });
    }
    
    // 为设置模态框添加隐藏事件监听器，确保清理工作
    const settingsModalElement = document.getElementById('settingsModal');
    if (settingsModalElement) {
        const hideHandler = function() {
            // 确保背景遮罩完全清除
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
        };
        
        // 移除之前的事件监听器（如果有的话）
        settingsModalElement.removeEventListener('hidden.bs.modal', hideHandler);
        // 添加新的事件监听器
        settingsModalElement.addEventListener('hidden.bs.modal', hideHandler);
    }
    
    isInitialized = true;
}

/**
 * 显示房间设置模态框
 */
export async function showRoomSettings(roomId) {
    currentRoomId = roomId;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'warning');
            return;
        }

        // 获取房间信息
        const response = await fetch(`/api/rooms/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取房间信息失败');
        }

        const room = await response.json();
        
        // 填充表单数据
        document.getElementById('roomNameSetting').value = room.name;
        document.getElementById('requireApprovalSetting').checked = room.requireApproval;
        document.getElementById('allowImagesSetting').checked = room.allowImages;
        document.getElementById('allowVideosSetting').checked = room.allowVideos;
        document.getElementById('allowFilesSetting').checked = room.allowFiles;

        // 显示模态框
        const settingsModalElement = document.getElementById('settingsModal');
        if (settingsModalElement) {
            const modal = bootstrap.Modal.getOrCreateInstance(settingsModalElement);
            modal.show();
            
            // 如果是房主且房间需要审批，加载待处理请求并显示审批区域
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (room.creatorId === currentUser.userId && room.requireApproval) {
                await loadPendingRequests(currentRoomId, token);
                // 确保审批区域可见（即使没有请求也显示）
                const joinRequestsSection = document.getElementById('joinRequestsSection');
                if (joinRequestsSection) {
                    joinRequestsSection.style.display = 'block';
                }
            } else {
                // 隐藏审批区域
                const joinRequestsSection = document.getElementById('joinRequestsSection');
                if (joinRequestsSection) {
                    joinRequestsSection.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('显示房间设置失败:', error);
        showMessage('加载房间设置失败: ' + error.message, 'danger');
    }
}

/**
 * 保存房间设置
 */
export async function saveRoomSettings() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showMessage('请先登录', 'warning');
            return;
        }

        // 获取表单数据
        const name = document.getElementById('roomNameSetting').value;
        const requireApproval = document.getElementById('requireApprovalSetting').checked;
        const allowImages = document.getElementById('allowImagesSetting').checked;
        const allowVideos = document.getElementById('allowVideosSetting').checked;
        const allowFiles = document.getElementById('allowFilesSetting').checked;

        // 发送更新请求
        const response = await fetch(`/api/rooms/${currentRoomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                requireApproval,
                allowImages,
                allowVideos,
                allowFiles
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '更新失败');
        }

        const updatedRoom = await response.json();
        
        // 隐藏模态框
        const settingsModalElement = document.getElementById('settingsModal');
        if (settingsModalElement) {
            const modal = bootstrap.Modal.getInstance(settingsModalElement);
            modal.hide();
        }

        showMessage('设置已保存', 'success');
        
        // 如果房间设置为需要审批且用户是房主，则显示审批区域
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (updatedRoom.requireApproval && updatedRoom.creatorId === currentUser.userId) {
            const joinRequestsSection = document.getElementById('joinRequestsSection');
            if (joinRequestsSection) {
                joinRequestsSection.style.display = 'block';
            }
            // 重新加载待处理请求
            await loadPendingRequests(currentRoomId, token);
        }
        
        // 触发房间列表更新
        window.dispatchEvent(new CustomEvent('roomSettingsUpdated', { detail: updatedRoom }));
    } catch (error) {
        console.error('保存设置失败:', error);
        showMessage('保存失败: ' + error.message, 'danger');
    }
}