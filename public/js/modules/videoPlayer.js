/**
 * 视频播放器模块 - 提供视频全屏播放功能
 */

// 显示视频在模态框中并自动全屏
export function showVideoInModal(videoSrc) {
    // 创建或使用现有的模态框来显示视频
    let modal = document.getElementById('videoModal');
    if (!modal) {
        // 创建模态框
        modal = document.createElement('div');
        modal.id = 'videoModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-fullscreen">
                <div class="modal-content" style="background-color: rgba(0, 0, 0, 0.9);">
                    <div class="modal-header border-0">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body d-flex align-items-center justify-content-center p-0">
                        <video id="fullscreenVideo" src="${videoSrc}" controls autoplay style="max-height: 100vh; max-width: 100vw;"></video>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 监听模态框显示事件，视频自动全屏
        modal.addEventListener('shown.bs.modal', function() {
            const video = document.getElementById('fullscreenVideo');
            if (video) {
                // 尝试进入全屏模式
                if (video.requestFullscreen) {
                    video.requestFullscreen();
                } else if (video.webkitRequestFullscreen) {
                    video.webkitRequestFullscreen();
                } else if (video.mozRequestFullScreen) {
                    video.mozRequestFullScreen();
                } else if (video.msRequestFullscreen) {
                    video.msRequestFullscreen();
                }
                
                // 监听退出全屏事件，关闭模态框
                const exitHandler = () => {
                    if (!document.fullscreenElement && !document.webkitFullscreenElement && 
                        !document.mozFullScreenElement && !document.msFullscreenElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modal);
                        if (modalInstance) {
                            modalInstance.hide();
                        }
                    }
                };
                
                document.addEventListener('fullscreenchange', exitHandler);
                document.addEventListener('webkitfullscreenchange', exitHandler);
                document.addEventListener('mozfullscreenchange', exitHandler);
                document.addEventListener('MSFullscreenChange', exitHandler);
            }
        });
    } else {
        // 更新现有模态框中的视频源
        const video = modal.querySelector('#fullscreenVideo');
        if (video) {
            video.src = videoSrc;
        }
    }
    
    // 显示模态框
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

// 全屏播放视频的功能
export function playVideoInFullscreen(videoUrl) {
    // 获取或创建视频模态框
    let modal = document.getElementById('videoModal');
    
    // 更新视频源
    const video = document.getElementById('fullscreenVideo');
    video.src = videoUrl;
    
    // 显示模态框
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // 监听模态框隐藏事件，暂停视频
    modal.addEventListener('hidden.bs.modal', function() {
        // 暂停视频播放
        const video = document.getElementById('fullscreenVideo');
        if (video) {
            video.pause();
        }
    }, {once: true});
}