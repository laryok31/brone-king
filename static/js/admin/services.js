const ServicesManager = {
    services: [],
    categories: [],
    currentCategory: 'all',
    showInactive: false,
    showPopularOnly: false,
    searchQuery: '',

    async init() {
        await this.loadCategories();
        await this.load();
        this.bindEvents();
    },

    bindEvents() {
        // Поиск
        document.getElementById('serviceSearch')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // Фильтр неактивных
        document.getElementById('showInactive')?.addEventListener('click', () => {
            this.showInactive = !this.showInactive;
            document.getElementById('showInactive').classList.toggle('active', this.showInactive);
            this.render();
        });

        // Фильтр популярных
        document.getElementById('showPopular')?.addEventListener('click', () => {
            this.showPopularOnly = !this.showPopularOnly;
            document.getElementById('showPopular').classList.toggle('active', this.showPopularOnly);
            this.render();
        });
    },

    async loadCategories() {
        try {
            this.categories = await API.get('/services/categories');
            this.renderCategories();
        } catch (e) {
            console.error('Ошибка загрузки категорий:', e);
        }
    },

    renderCategories() {
        const container = document.getElementById('categoriesTabs');
        if (!container) return;

        const total = this.services.length;

        let html = `<button class="category-tab active" data-category="all" onclick="ServicesManager.filterByCategory('all')">
            <span>Все услуги</span>
            <span class="count">${total}</span>
        </button>`;

        this.categories.forEach(cat => {
            html += `<button class="category-tab" data-category="${cat.name}" onclick="ServicesManager.filterByCategory('${cat.name}')">
                <span>${this.getCategoryName(cat.name)}</span>
                <span class="count">${cat.count}</span>
            </button>`;
        });

        container.innerHTML = html;
    },

    getCategoryName(cat) {
        const names = {
            'food': 'Питание',
            'transfer': 'Трансфер',
            'spa': 'Спа',
            'entertainment': 'Развлечения',
            'accommodation': 'Проживание',
            'other': 'Прочее'
        };
        return names[cat] || cat;
    },

    filterByCategory(category) {
        this.currentCategory = category;

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        this.render();
    },

    async load() {
        try {
            let url = '/services/?';
            if (this.currentCategory !== 'all') url += `category=${this.currentCategory}&`;

            this.services = await API.get(url);
            this.updateStats();
            this.render();
        } catch (e) {
            console.error('Ошибка загрузки услуг:', e);
        }
    },

    updateStats() {
        const active = this.services.filter(s => s.is_active);
        const popular = this.services.filter(s => s.is_popular);
        const totalValue = active.reduce((sum, s) => sum + s.price, 0);

        document.getElementById('totalServices').textContent = this.services.length;
        document.getElementById('activeServices').textContent = active.length;
        document.getElementById('popularServices').textContent = popular.length;
        document.getElementById('avgPrice').textContent = this.formatPrice(totalValue / (active.length || 1));
    },

    render() {
        const container = document.getElementById('servicesGrid');
        if (!container) return;

        let filtered = this.services;

        if (!this.showInactive) {
            filtered = filtered.filter(s => s.is_active);
        }

        if (this.showPopularOnly) {
            filtered = filtered.filter(s => s.is_popular);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(this.searchQuery) ||
                (s.description || '').toLowerCase().includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-concierge-bell"></i><p>Услуги не найдены</p></div>';
            return;
        }

        container.innerHTML = filtered.map(s => this.renderServiceCard(s)).join('');
    },

    renderServiceCard(service) {
        const icon = service.icon || 'fa-circle';

        return `
            <div class="service-card ${!service.is_active ? 'inactive' : ''}">
                ${service.is_popular ? '<span class="popular-badge"><i class="fas fa-star"></i> Популярная</span>' : ''}
                <div class="service-header">
                    <div class="service-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="service-info">
                        <div class="service-name">
                            ${service.name}
                        </div>
                        <span class="service-category">${this.getCategoryName(service.category)}</span>
                    </div>
                </div>
                <div class="service-description">
                    ${service.description || 'Нет описания'}
                </div>
                <div class="service-footer">
                    <div class="service-price">
                        ${this.formatPrice(service.price)}
                        <small>/${service.unit}</small>
                    </div>
                    <div class="service-actions">
                        <button class="btn-icon" onclick="ServicesManager.togglePopular(${service.id})" title="${service.is_popular ? 'Убрать из популярных' : 'В популярные'}">
                            <i class="fas fa-star" style="color: ${service.is_popular ? '#fbbf24' : '#9ca3af'};"></i>
                        </button>
                        <button class="btn-icon" onclick="ServicesManager.toggleActive(${service.id})" title="${service.is_active ? 'Деактивировать' : 'Активировать'}">
                            <i class="fas fa-${service.is_active ? 'toggle-on' : 'toggle-off'}" style="color: ${service.is_active ? '#10b981' : '#9ca3af'};"></i>
                        </button>
                        <button class="btn-icon" onclick="ServicesManager.edit(${service.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="ServicesManager.delete(${service.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    openPanel() {
        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Новая услуга';
        document.getElementById('serviceForm').reset();
        document.getElementById('serviceId').value = '';
        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('selected'));
    },

    async edit(id) {
        const service = this.services.find(s => s.id === id);
        if (!service) return;

        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-edit"></i> Редактировать услугу';
        document.getElementById('serviceId').value = service.id;
        document.getElementById('serviceName').value = service.name;
        document.getElementById('serviceDescription').value = service.description || '';
        document.getElementById('servicePrice').value = service.price;
        document.getElementById('serviceCategory').value = service.category;
        document.getElementById('serviceUnit').value = service.unit;

        document.querySelectorAll('.icon-option').forEach(i => {
            i.classList.toggle('selected', i.dataset.icon === service.icon);
        });

        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
    },

    closePanel() {
        document.getElementById('slideOverlay').classList.remove('active');
        document.getElementById('slidePanel').classList.remove('active');
    },

    selectIcon(icon) {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        document.getElementById('selectedIcon').value = icon;
    },

    async save() {
        const id = document.getElementById('serviceId').value;
        const selectedIcon = document.querySelector('.icon-option.selected')?.dataset.icon || 'fa-circle';

        const data = {
            name: document.getElementById('serviceName').value.trim(),
            description: document.getElementById('serviceDescription').value.trim(),
            price: parseFloat(document.getElementById('servicePrice').value) || 0,
            category: document.getElementById('serviceCategory').value,
            unit: document.getElementById('serviceUnit').value,
            icon: selectedIcon
        };

        if (!data.name) {
            alert('Введите название услуги');
            return;
        }

        try {
            if (id) {
                await API.put(`/services/${id}`, data);
                alert('✅ Услуга обновлена');
            } else {
                await API.post('/services/', data);
                alert('✅ Услуга добавлена');
            }
            this.closePanel();
            await this.load();
            await this.loadCategories();
        } catch (e) {
            alert('❌ Ошибка сохранения');
        }
    },

    async toggleActive(id) {
        try {
            const result = await API.post(`/services/${id}/toggle`);
            const service = this.services.find(s => s.id === id);
            if (service) service.is_active = result.is_active;
            this.updateStats();
            this.render();
        } catch (e) {
            alert('❌ Ошибка');
        }
    },

    async togglePopular(id) {
        try {
            const result = await API.post(`/services/${id}/popular`);
            const service = this.services.find(s => s.id === id);
            if (service) service.is_popular = result.is_popular;
            this.updateStats();
            this.render();
        } catch (e) {
            alert('❌ Ошибка');
        }
    },

    async delete(id) {
        if (!confirm('Удалить услугу?')) return;
        try {
            await API.delete(`/services/${id}`);
            alert('✅ Услуга удалена');
            await this.load();
            await this.loadCategories();
        } catch (e) {
            alert('❌ Ошибка удаления');
        }
    },

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(price);
    }
};

window.ServicesManager = ServicesManager;