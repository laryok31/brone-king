// Основной модуль админки
const Admin = {
    init() {
        this.checkAuth();
        this.bindEvents();
        this.loadUserInfo();
    },

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = Utils.getCurrentUser();

        if (!token || !user || user.role !== 'admin') {
            window.location.href = '/login';
        }
    },

    bindEvents() {
        // Мобильное меню
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const sidebar = document.querySelector('.admin-sidebar');

        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
        }

        // Закрытие модалок
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    },

    loadUserInfo() {
        const user = Utils.getCurrentUser();
        const nameEl = document.getElementById('userName');
        if (nameEl && user) {
            nameEl.textContent = user.full_name || user.username;
        }
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => Admin.init());

// Глобальные функции
window.closeModal = (modalId) => {
    document.getElementById(modalId)?.classList.remove('active');
};

window.openModal = (modalId) => {
    document.getElementById(modalId)?.classList.add('active');
};