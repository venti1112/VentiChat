// 个人资料管理模块

// 更新个人资料
export async function updateProfile(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    try {
        // 显示加载状态
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...';
        
        // 构建基本的用户资料更新数据
        const profileData = {
            nickname: formData.get('nickname')
        };
        
        // 构建偏好设置更新数据
        const preferencesData = {
            themeColor: formData.get('themeColor')
        };
        
        // 检查是否有新的头像文件
        const avatarFile = document.getElementById('avatarInput').files[0];
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }
        
        // 检查是否有新的背景图片文件
        const bgFile = document.getElementById('backgroundImage').files[0];
        if (bgFile) {
            // 上传背景图片
            const bgFormData = new FormData();
            bgFormData.append('background', bgFile);
            
            const bgResponse = await fetch('/api/users/upload-background', {
                method: 'POST',
                body: bgFormData,
                credentials: 'include'
            });
            
            if (!bgResponse.ok) {
                throw new Error('背景图片上传失败');
            }
            
            const bgResult = await bgResponse.json();
            preferencesData.backgroundUrl = bgResult.backgroundUrl;
        }
        
        // 更新用户资料（包括头像）
        const profileResponse = await fetch('/api/users/profile', {
            method: 'PUT',
            body: avatarFile ? formData : JSON.stringify(profileData),
            headers: avatarFile ? {
            } : {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!profileResponse.ok) {
            throw new Error('用户资料更新失败');
        }
        
        // 更新偏好设置
        const preferencesResponse = await fetch('/api/users/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(preferencesData)
        });
        
        if (!preferencesResponse.ok) {
            throw new Error('偏好设置更新失败');
        }
        
        // 获取更新后的用户信息
        const profileResult = await profileResponse.json();
        const preferencesResult = await preferencesResponse.json();
        
        // 更新本地存储的用户信息
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = {
            ...currentUser,
            nickname: profileResult.user.nickname,
            avatarUrl: profileResult.user.avatarUrl
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 更新页面上的用户信息显示
        const userNickname = document.getElementById('userNickname');
        const userAvatar = document.getElementById('userAvatar');
        if (userNickname) userNickname.textContent = updatedUser.nickname;
        if (userAvatar) userAvatar.src = updatedUser.avatarUrl;
        
        // 应用新的个性化设置
        const newPreferences = {
            backgroundUrl: preferencesResult.preferences.backgroundUrl,
            themeColor: preferencesResult.preferences.themeColor
        };
        window.applyUserPreferences(newPreferences);
        
        // 显示成功消息
        window.showMessage('个人资料更新成功！', 'success');
        
        // 关闭弹窗
        window.closeProfilePopup();
    } catch (error) {
        console.error('更新个人资料失败:', error);
        window.showMessage(`更新失败: ${error.message}`, 'danger');
    } finally {
        // 恢复按钮状态
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// 个人中心表单提交
export function bindProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateProfile);
    }
}