function showLoading() { document.querySelector('.loading-overlay')?.classList.add('active'); }
function hideLoading() { document.querySelector('.loading-overlay')?.classList.remove('active'); }

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function logout() { localStorage.clear(); window.location.href = '/'; }

const Toast = {
    show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i><span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); }
};

const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`/api/v1${endpoint}`, { ...options, headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    },
    get: (e) => API.request(e),
    post: (e, d) => API.request(e, { method: 'POST', body: JSON.stringify(d) }),
    put: (e, d) => API.request(e, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (e) => API.request(e, { method: 'DELETE' })
};