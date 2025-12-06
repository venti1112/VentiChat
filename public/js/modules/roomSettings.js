// roomSettings.js - 处理房间设置和审批请求功能

import { showMessage } from './ui.js';
import { loadPendingRequests, displayPendingRequests } from './roomManager.js';

let isInitialized = false;

/**
 * 初始化房间设置模块
 */
export function initializeRoomSettings() {
    if (isInitialized) return;
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', handleSettingsClick);
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
 * 处理设置按钮点击事件
 */
async function handleSettingsClick() {
    const currentRoomId = localStorage.getItem('currentRoomId');
    if (!currentRoomId) {
        showMessage('请先选择一个聊天室', 'warning');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('未登录，请先登录', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${currentRoomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('获取聊天室信息失败');
        }

        const room = await response.json();

        // 填充表单数据
        document.getElementById('roomNameSetting').value = room.name;
        document.getElementById('requireApprovalSetting').checked = room.requireApproval;
        document.getElementById('allowImagesSetting').checked = room.allowImages;
        document.getElementById('allowVideosSetting').checked = room.allowVideos;
        document.getElementById('allowFilesSetting').checked = room.allowFiles;

        // 使用Bootstrap内置方法显示设置模态框，而不是手动创建实例
        const settingsModalElement = document.getElementById('settingsModal');
        if (settingsModalElement) {
            // 使用Bootstrap原生JS方法显示模态框
            const modal = bootstrap.Modal.getOrCreateInstance(settingsModalElement);
            modal.show();
            
            // 如果是房主，加载待处理请求
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (room.creatorId === currentUser.userId) {
                await loadPendingRequests(currentRoomId, token);
                // 确保审批区域可见
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
        console.error('获取聊天室设置错误:', error);
        showMessage('获取聊天室设置失败: ' + error.message, 'danger');
    }
}

/**
 * 处理加入请求（批准或拒绝）
 */
export async function handleJoinRequest(roomId, userId, action) {
    const token = localStorage.getItem('token');
    if (!token) {
        showMessage('未登录', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/rooms/${roomId}/approve-join-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: parseInt(userId),
                action: action
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // 显示成功消息
        showMessage(action === 'approve' ? '已允许用户加入' : '已拒绝用户加入请求', 'success');

        // 重新加载待处理请求
        await loadPendingRequests(roomId, token);
    } catch (error) {
        console.error('处理加入请求失败:', error);
        showMessage('处理失败: ' + error.message, 'danger');
    }
}