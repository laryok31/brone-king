// UI компоненты
const UI = {
    showLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.style.display = 'flex';
    },

    hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    toast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            position: fixed; top: 24px; right: 24px; background: white;
            padding: 14px 20px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 10000; display: flex; align-items: center; gap: 12px;
            border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            animation: slideInRight 0.3s ease; max-width: 380px;
        `;

        const icons = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };

        toast.innerHTML = `
            <i class="fas fa-${icons[type]}" style="color: ${colors[type]}; font-size: 20px;"></i>
            <span style="color: #1f2937; font-weight: 500;">${message}</span>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

window.showLoading = UI.showLoading;
window.hideLoading = UI.hideLoading;
window.Toast = UI;
window.openModal = UI.openModal;
window.closeModal = UI.closeModal;