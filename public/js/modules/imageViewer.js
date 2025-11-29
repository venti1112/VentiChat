/**
 * 图片查看器模块 - 提供图片放大、缩小和拖拽移动功能
 */

class ImageViewer {
    constructor() {
        this.modal = null;
        this.image = null;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 10;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.translateX = 0;
        this.translateY = 0;
        this.currentTranslateX = 0;
        this.currentTranslateY = 0;
        this.init();
    }

    init() {
        // 获取模态框和图片元素
        this.modal = document.getElementById('imageModal');
        this.image = document.getElementById('fullScreenImage');
        
        if (!this.modal || !this.image) {
            console.warn('ImageViewer: 未找到图片查看器所需的DOM元素');
            return;
        }

        // 绑定事件监听器
        this.bindEvents();
    }

    bindEvents() {
        // 鼠标滚轮缩放
        this.image.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // 鼠标按下开始拖拽
        this.image.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        
        // 鼠标移动进行拖拽
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // 鼠标松开结束拖拽
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // 双击重置视图
        this.image.addEventListener('dblclick', () => this.resetView());
        
        // 模态框关闭时重置状态
        this.modal.addEventListener('hidden.bs.modal', () => this.resetView());
    }

    handleWheel(e) {
        e.preventDefault();
        
        // 计算缩放比例
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = this.scale * delta;
        
        // 限制缩放范围
        if (newScale >= this.minScale && newScale <= this.maxScale) {
            this.scale = newScale;
            this.applyTransform();
        }
    }

    handleMouseDown(e) {
        if (e.button !== 0) return; // 只处理左键
        
        this.isDragging = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        this.image.style.cursor = 'grabbing';
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.applyTransform();
    }

    handleMouseUp(e) {
        if (e.button !== 0) return; // 只处理左键
        
        this.isDragging = false;
        this.currentTranslateX = this.translateX;
        this.currentTranslateY = this.translateY;
        this.image.style.cursor = 'grab';
    }

    applyTransform() {
        this.image.style.transform = `scale(${this.scale}) translate(${this.translateX / this.scale}px, ${this.translateY / this.scale}px)`;
    }

    resetView() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.currentTranslateX = 0;
        this.currentTranslateY = 0;
        this.applyTransform();
        this.image.style.cursor = 'default';
    }
}

// 初始化图片查看器
document.addEventListener('DOMContentLoaded', () => {
    window.imageViewer = new ImageViewer();
});

// 导出模块（如果需要）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageViewer;
}