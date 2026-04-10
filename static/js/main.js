const Utils = {
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount || 0);
    },
    
    formatDate(dateString) {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('ru-RU');
    },
    
    formatDateTime(dateString) {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleString('ru-RU');
    },
    
    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
    
    logout() {
        localStorage.clear();
        window.location.href = '/login';
    }
};

const Toast = {
    show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 24px; right: 24px; background: white;
            padding: 14px 20px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 10000; display: flex; align-items: center; gap: 12px;
            border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
            animation: slideIn 0.3s ease; max-width: 400px;
        `;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },
    success: (m) => Toast.show(m, 'success'),
    error: (m) => Toast.show(m, 'error'),
    info: (m) => Toast.show(m, 'info')
};

const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/v1${endpoint}`, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401) { Utils.logout(); throw new Error('Не авторизован'); }
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }
        return response.status !== 204 ? await response.json() : null;
    },
    get: (e) => API.request(e),
    post: (e, d) => API.request(e, { method: 'POST', body: JSON.stringify(d) }),
    put: (e, d) => API.request(e, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (e) => API.request(e, { method: 'DELETE' })
};

const UI = {
    loading: document.querySelector('.loading-overlay'),
    showLoading() { if (this.loading) this.loading.style.display = 'flex'; },
    hideLoading() { if (this.loading) this.loading.style.display = 'none'; },
    openModal(id) { document.getElementById(id)?.classList.add('active'); },
    closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
};

window.Utils = Utils;
window.Toast = Toast;
window.API = API;
window.UI = UI;