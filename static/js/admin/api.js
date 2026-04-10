// API клиент
const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`/api/v1${endpoint}`, { ...options, headers });
            if (!response.ok) {
                if (response.status === 401) {
                    Utils.logout();
                    throw new Error('Не авторизован');
                }
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get: (e) => API.request(e),
    post: (e, d) => API.request(e, { method: 'POST', body: JSON.stringify(d) }),
    put: (e, d) => API.request(e, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (e) => API.request(e, { method: 'DELETE' })
};

window.API = API;