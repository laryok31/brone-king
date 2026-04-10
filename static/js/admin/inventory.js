const InventoryManager = {
    items: [],
    categories: [],
    movements: [],
    currentCategory: 'all',
    showLowStock: false,
    searchQuery: '',

    async init() {
        await this.loadCategories();
        await this.loadItems();
        await this.loadSummary();
        await this.loadMovements();
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderItems();
        });

        document.getElementById('showLowStock')?.addEventListener('change', (e) => {
            this.showLowStock = e.target.checked;
            this.renderItems();
        });
    },

    async loadCategories() {
        try {
            this.categories = await API.get('/inventory/categories');
            this.renderCategories();
        } catch (e) {
            console.error('Ошибка загрузки категорий:', e);
        }
    },

    renderCategories() {
        const container = document.getElementById('categoriesTabs');
        if (!container) return;

        const total = this.items.length;

        let html = `<div class="category-tab active" data-category="all" onclick="InventoryManager.filterByCategory('all')">
            <i class="fas fa-boxes"></i> Все товары
            <span class="count">${total}</span>
        </div>`;

        this.categories.forEach(cat => {
            const count = this.items.filter(i => i.category_id === cat.id).length;
            html += `<div class="category-tab" data-category="${cat.id}" onclick="InventoryManager.filterByCategory(${cat.id})">
                <i class="fas ${cat.icon}"></i> ${cat.name}
                <span class="count">${count}</span>
            </div>`;
        });

        container.innerHTML = html;
    },

    filterByCategory(categoryId) {
        this.currentCategory = categoryId;

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active',
                categoryId === 'all' ? tab.dataset.category === 'all' : tab.dataset.category == categoryId);
        });

        this.renderItems();
    },

    async loadItems() {
        try {
            let url = '/inventory/items?';
            if (this.currentCategory !== 'all') url += `category_id=${this.currentCategory}&`;
            if (this.showLowStock) url += 'low_stock=true&';

            this.items = await API.get(url);
            this.renderItems();
        } catch (e) {
            console.error('Ошибка загрузки товаров:', e);
        }
    },

    renderItems() {
        const container = document.getElementById('inventoryGrid');
        if (!container) return;

        let filtered = this.items;

        if (this.searchQuery) {
            filtered = filtered.filter(i =>
                i.name.toLowerCase().includes(this.searchQuery) ||
                (i.sku || '').toLowerCase().includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Товары не найдены</p></div>';
            return;
        }

        container.innerHTML = filtered.map(item => this.renderItemCard(item)).join('');
    },

    renderItemCard(item) {
        const category = this.categories.find(c => c.id === item.category_id);
        const stockPercent = (item.current_stock / item.maximum_stock) * 100;
        const isLowStock = item.current_stock <= item.minimum_stock;

        let stockClass = 'stock-fill';
        if (stockPercent < 30) stockClass += ' danger';
        else if (stockPercent < 60) stockClass += ' warning';

        return `
            <div class="item-card ${isLowStock ? 'low-stock' : ''}">
                <div class="item-header">
                    <div class="item-icon" style="background: ${category?.color || '#6366f1'};">
                        <i class="fas ${category?.icon || 'fa-box'}"></i>
                    </div>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-sku">${item.sku || '—'}</div>
                    </div>
                    <div>
                        <button class="btn-icon" onclick="InventoryManager.editItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>

                <div class="item-stock">
                    <div class="stock-bar">
                        <div class="${stockClass}" style="width: ${Math.min(stockPercent, 100)}%;"></div>
                    </div>
                    <div class="stock-info">
                        <span>В наличии: <strong>${item.current_stock} ${item.unit}</strong></span>
                        <span>Мин: ${item.minimum_stock}</span>
                    </div>
                </div>

                <div class="item-prices">
                    <div class="price-item">
                        <div class="price-label">Закупка</div>
                        <div class="price-value">${this.formatPrice(item.purchase_price)}</div>
                    </div>
                    <div class="price-item">
                        <div class="price-label">Продажа</div>
                        <div class="price-value selling">${this.formatPrice(item.selling_price)}</div>
                    </div>
                    <div class="price-item">
                        <div class="price-label">Маржа</div>
                        <div class="price-value" style="color: ${item.selling_price > item.purchase_price ? '#10b981' : '#ef4444'};">
                            ${item.selling_price - item.purchase_price > 0 ? '+' : ''}${this.formatPrice(item.selling_price - item.purchase_price)}
                        </div>
                    </div>
                </div>

                <div class="item-actions">
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager.quickMovement(${item.id}, 'in')">
                        <i class="fas fa-plus"></i> Приход
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager.quickMovement(${item.id}, 'out')">
                        <i class="fas fa-minus"></i> Расход
                    </button>
                </div>
            </div>
        `;
    },

    async loadSummary() {
        try {
            const summary = await API.get('/inventory/summary');
            document.getElementById('totalItems').textContent = summary.total_items;
            document.getElementById('totalValue').textContent = this.formatPrice(summary.total_value);
            document.getElementById('lowStockCount').textContent = summary.low_stock_count;
            document.getElementById('totalPurchases').textContent = this.formatPrice(summary.total_purchases);
            document.getElementById('totalSales').textContent = this.formatPrice(summary.total_sales);
        } catch (e) {}
    },

    async loadMovements() {
        try {
            this.movements = await API.get('/inventory/movements?limit=20');
            this.renderMovements();
        } catch (e) {}
    },

    renderMovements() {
        const container = document.getElementById('movementsTable');
        if (!container) return;

        if (this.movements.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center">Нет движений</td></tr>';
            return;
        }

        container.innerHTML = this.movements.map(m => {
            const item = this.items.find(i => i.id === m.item_id);
            const typeBadges = {
                'in': '<span class="movement-badge movement-in"><i class="fas fa-arrow-down"></i> Приход</span>',
                'out': '<span class="movement-badge movement-out"><i class="fas fa-arrow-up"></i> Расход</span>',
                'adjustment': '<span class="movement-badge movement-adjustment"><i class="fas fa-sync-alt"></i> Корректировка</span>',
                'waste': '<span class="movement-badge movement-waste"><i class="fas fa-trash"></i> Списание</span>'
            };

            return `
                <tr>
                    <td>${this.formatDateTime(m.created_at)}</td>
                    <td><strong>${item?.name || '—'}</strong></td>
                    <td>${typeBadges[m.movement_type] || m.movement_type}</td>
                    <td>${m.quantity} ${item?.unit || 'шт'}</td>
                    <td>${this.formatPrice(m.total_amount)}</td>
                    <td>${m.notes || '—'}</td>
                </tr>
            `;
        }).join('');
    },

    openPanel() {
        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Новый товар';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';

        const categorySelect = document.getElementById('itemCategory');
        categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
        this.categories.forEach(c => {
            categorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });

        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
    },

    editItem(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-edit"></i> Редактировать товар';
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemUnit').value = item.unit;
        document.getElementById('itemMinStock').value = item.minimum_stock;
        document.getElementById('itemMaxStock').value = item.maximum_stock;
        document.getElementById('itemPurchasePrice').value = item.purchase_price;
        document.getElementById('itemSellingPrice').value = item.selling_price;
        document.getElementById('itemSupplier').value = item.supplier || '';
        document.getElementById('itemLocation').value = item.location || '';

        const categorySelect = document.getElementById('itemCategory');
        categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
        this.categories.forEach(c => {
            categorySelect.innerHTML += `<option value="${c.id}" ${c.id === item.category_id ? 'selected' : ''}>${c.name}</option>`;
        });

        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
    },

    closePanel() {
        document.getElementById('slideOverlay').classList.remove('active');
        document.getElementById('slidePanel').classList.remove('active');
    },

    async saveItem() {
        const id = document.getElementById('itemId').value;
        const data = {
            category_id: parseInt(document.getElementById('itemCategory').value),
            name: document.getElementById('itemName').value.trim(),
            unit: document.getElementById('itemUnit').value,
            minimum_stock: parseFloat(document.getElementById('itemMinStock').value) || 10,
            maximum_stock: parseFloat(document.getElementById('itemMaxStock').value) || 100,
            purchase_price: parseFloat(document.getElementById('itemPurchasePrice').value) || 0,
            selling_price: parseFloat(document.getElementById('itemSellingPrice').value) || 0,
            supplier: document.getElementById('itemSupplier').value.trim(),
            location: document.getElementById('itemLocation').value.trim()
        };

        if (!data.name || !data.category_id) {
            alert('Заполните обязательные поля');
            return;
        }

        try {
            if (id) {
                await API.put(`/inventory/items/${id}`, data);
            } else {
                await API.post('/inventory/items/', data);
            }

            this.closePanel();
            await this.loadItems();
            await this.loadSummary();
            await this.loadCategories();
        } catch (e) {
            alert('Ошибка сохранения');
        }
    },

    async quickMovement(itemId, type) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const quantity = prompt(`Введите количество (${item.unit}) для ${type === 'in' ? 'прихода' : 'расхода'}:`, '1');
        if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) return;

        const notes = prompt('Примечание (необязательно):', type === 'in' ? 'Поступление' : 'Продажа');

        try {
            await API.post('/inventory/movements', {
                item_id: itemId,
                movement_type: type,
                quantity: parseFloat(quantity),
                reference_type: type === 'in' ? 'purchase' : 'sale',
                notes: notes || (type === 'in' ? 'Поступление' : 'Продажа')
            });

            await this.loadItems();
            await this.loadSummary();
            await this.loadMovements();
        } catch (e) {
            alert('Ошибка: ' + (e.message || 'Недостаточно товара'));
        }
    },

    openCategoryPanel() {
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryModal').style.display = 'flex';
    },

    async saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        if (!name) return;

        try {
            await API.post('/inventory/categories', { name });
            document.getElementById('categoryModal').style.display = 'none';
            await this.loadCategories();
        } catch (e) {
            alert('Ошибка создания категории');
        }
    },

    formatDate(date) {
        return date ? new Date(date).toLocaleDateString('ru-RU') : '—';
    },

    formatDateTime(date) {
        return date ? new Date(date).toLocaleString('ru-RU') : '—';
    },

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price);
    }
};

window.InventoryManager = InventoryManager;