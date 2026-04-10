const FinanceManager = {
    transactions: [],
    categories: [],
    employees: [],
    currentPeriod: 'month',

    async init() {
        await this.initDefaults();
        await this.loadCategories();
        await this.loadTransactions();
        await this.loadEmployees();
        await this.loadSummary();
        this.setDefaultDates();
        this.bindEvents();
        this.loadSuggestions();
        this.loadFinanceSettings();
    },

    async loadSuggestions() {
        try {
            const suggestions = await API.get('/tasks/suggestions');
            this.renderSuggestions(suggestions);
        } catch (e) {
            // Используем локальные подсказки
            this.renderLocalSuggestions();
        }
    },

    renderSuggestions(suggestions) {
        const container = document.getElementById('suggestionsList');
        if (!suggestions.length) {
            container.innerHTML = `
                <div class="suggestion-item success">
                    <i class="fas fa-check-circle"></i>
                    <span>Всё в порядке! Система работает штатно.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = suggestions.map(s => `
            <div class="suggestion-item ${s.type}" onclick="window.location.href='${s.action}'">
                <i class="fas fa-${s.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${s.message}</span>
                <span class="suggestion-action">Перейти →</span>
            </div>
        `).join('');
    },

    renderLocalSuggestions() {
        const container = document.getElementById('suggestionsList');

        // Анализируем локальные данные
        const lowStock = this.inventoryItems?.filter(i => i.current_stock <= i.minimum_stock) || [];
        const pendingBookings = this.bookings?.filter(b => b.status === 'pending') || [];
        const cleaningRooms = this.rooms?.filter(r => r.status === 'cleaning') || [];

        let html = '';

        if (cleaningRooms.length > 0) {
            html += `
                <div class="suggestion-item warning" onclick="window.location.href='/admin/rooms'">
                    <i class="fas fa-broom"></i>
                    <span>${cleaningRooms.length} номеров требуют уборки</span>
                    <span class="suggestion-action">Убрать →</span>
                </div>
            `;
        }

        if (pendingBookings.length > 0) {
            html += `
                <div class="suggestion-item info" onclick="window.location.href='/admin/bookings'">
                    <i class="fas fa-clock"></i>
                    <span>${pendingBookings.length} броней ожидают подтверждения</span>
                    <span class="suggestion-action">Проверить →</span>
                </div>
            `;
        }

        if (lowStock.length > 0) {
            html += `
                <div class="suggestion-item warning" onclick="window.location.href='/admin/inventory'">
                    <i class="fas fa-box"></i>
                    <span>${lowStock.length} товаров заканчиваются на складе</span>
                    <span class="suggestion-action">Заказать →</span>
                </div>
            `;
        }

        if (!html) {
            html = `
                <div class="suggestion-item success">
                    <i class="fas fa-check-circle"></i>
                    <span>Всё в порядке! Система работает штатно.</span>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    toggleSettings() {
        const body = document.getElementById('financeSettingsBody');
        const chevron = document.getElementById('settingsChevron');

        if (body.style.display === 'none') {
            body.style.display = 'block';
            chevron.style.transform = 'rotate(180deg)';
        } else {
            body.style.display = 'none';
            chevron.style.transform = 'rotate(0deg)';
        }
    },

    loadFinanceSettings() {
        const saved = localStorage.getItem('financeSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            document.getElementById('autoIncome').checked = settings.autoIncome !== false;
            document.getElementById('autoPurchases').checked = settings.autoPurchases !== false;
            document.getElementById('autoSalary').checked = settings.autoSalary || false;
            document.getElementById('vatRate').value = settings.vatRate || 20;
            document.getElementById('feeRate').value = settings.feeRate || 2.5;
            document.getElementById('profitTax').value = settings.profitTax || 20;
        }

        // Сохраняем при изменении
        document.querySelectorAll('.finance-settings-card input').forEach(input => {
            input.addEventListener('change', () => this.saveFinanceSettings());
        });
    },

    saveFinanceSettings() {
        const settings = {
            autoIncome: document.getElementById('autoIncome')?.checked,
            autoPurchases: document.getElementById('autoPurchases')?.checked,
            autoSalary: document.getElementById('autoSalary')?.checked,
            vatRate: document.getElementById('vatRate')?.value,
            feeRate: document.getElementById('feeRate')?.value,
            profitTax: document.getElementById('profitTax')?.value
        };
        localStorage.setItem('financeSettings', JSON.stringify(settings));
    },

    async initDefaults() {
        try { await API.post('/finance/init-defaults'); } catch (e) {}
    },

    bindEvents() {
        // Периоды
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.setPeriodDates(this.currentPeriod);
                this.loadTransactions();
                this.loadSummary();
            });
        });

        // Вкладки
        document.querySelectorAll('.finance-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.finance-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.finance-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`panel${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
            });
        });
    },

    setDefaultDates() {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const startInput = document.getElementById('financeStartDate');
        const endInput = document.getElementById('financeEndDate');
        const salaryStart = document.getElementById('salaryStartDate');
        const salaryEnd = document.getElementById('salaryEndDate');

        if (startInput) startInput.value = this.formatDate(monthStart);
        if (endInput) endInput.value = this.formatDate(monthEnd);
        if (salaryStart) salaryStart.value = this.formatDate(monthStart);
        if (salaryEnd) salaryEnd.value = this.formatDate(monthEnd);
    },

    setPeriodDates(period) {
        const today = new Date();
        let start, end;
        switch(period) {
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'quarter':
                const q = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), q * 3, 1);
                end = new Date(today.getFullYear(), (q + 1) * 3, 0);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
        }
        document.getElementById('financeStartDate').value = this.formatDate(start);
        document.getElementById('financeEndDate').value = this.formatDate(end);
    },

    async loadCategories() {
        try {
            this.categories = await API.get('/finance/categories');
        } catch (e) {}
    },

    async loadTransactions() {
        const start = document.getElementById('financeStartDate')?.value;
        const end = document.getElementById('financeEndDate')?.value;
        let url = '/finance/transactions?limit=50';
        if (start) url += `&start_date=${start}`;
        if (end) url += `&end_date=${end}`;

        try {
            this.transactions = await API.get(url);
            this.renderTransactions();
        } catch (e) {}
    },

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        if (!this.transactions.length) {
            container.innerHTML = '<div class="empty-state">Нет транзакций</div>';
            return;
        }

        container.innerHTML = this.transactions.map(t => {
            const cat = this.categories.find(c => c.id === t.category_id);
            return `
                <div class="transaction-item">
                    <div class="transaction-icon" style="background: ${cat?.color || '#6366f1'};">
                        <i class="fas ${cat?.icon || 'fa-circle'}"></i>
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-desc">${cat?.name || 'Без категории'}</div>
                        <div class="transaction-meta">${this.formatDate(t.transaction_date)}</div>
                    </div>
                    <div class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${this.formatPrice(t.amount)}</div>
                </div>
            `;
        }).join('');
    },

    async loadEmployees() {
        try {
            this.employees = await API.get('/employees/');
            this.renderEmployees();
        } catch (e) {}
    },

    renderEmployees() {
        const grid = document.getElementById('employeesGrid');
        if (!this.employees.length) {
            grid.innerHTML = '<div class="empty-state">Нет сотрудников</div>';
            return;
        }

        grid.innerHTML = this.employees.map(e => `
            <div class="employee-card">
                <div class="employee-name">${e.full_name}</div>
                <div class="employee-position">${this.getPositionName(e.position)}</div>
                <div>📞 ${e.phone || '—'}</div>
                <div class="employee-salary">
                    <span>Оклад: ${this.formatPrice(e.base_salary)}</span>
                    <span>Ставка: ${this.formatPrice(e.hourly_rate)}/ч</span>
                </div>
            </div>
        `).join('');
    },

    async loadSummary() {
        const start = document.getElementById('financeStartDate')?.value;
        const end = document.getElementById('financeEndDate')?.value;
        let url = '/finance/summary';
        if (start) url += `?start_date=${start}`;
        if (end) url += `&end_date=${end}`;

        try {
            const s = await API.get(url);
            document.getElementById('totalIncome').textContent = this.formatPrice(s.total_income);
            document.getElementById('totalExpense').textContent = this.formatPrice(s.total_expense);
            document.getElementById('balance').textContent = this.formatPrice(s.balance);
            document.getElementById('bookingsRevenue').textContent = this.formatPrice(s.bookings_revenue);
            document.getElementById('inventoryPurchases').textContent = this.formatPrice(s.inventory_purchases);
            document.getElementById('salariesTotal').textContent = this.formatPrice(s.salaries_total);

            const margin = s.total_income > 0 ? ((s.total_income - s.total_expense) / s.total_income * 100) : 0;
            document.getElementById('profitMargin').textContent = margin.toFixed(1) + '%';
        } catch (e) {}
    },

    openTransactionPanel(type) {
        document.getElementById('transactionType').value = type;
        document.getElementById('transactionModalTitle').textContent = type === 'income' ? 'Новый доход' : 'Новый расход';

        const select = document.getElementById('transactionCategory');
        select.innerHTML = '<option value="">Выберите категорию</option>';
        this.categories.filter(c => c.type === type).forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });

        document.getElementById('transactionForm').reset();
        document.getElementById('transactionDate').value = this.formatDate(new Date());
        UI.openModal('transactionModal');
    },

    async saveTransaction() {
        const data = {
            category_id: parseInt(document.getElementById('transactionCategory').value),
            type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value) || 0,
            description: document.getElementById('transactionDesc').value,
            payment_method: document.getElementById('paymentMethod').value,
            transaction_date: document.getElementById('transactionDate').value
        };

        if (!data.category_id || data.amount <= 0) { alert('Заполните поля'); return; }

        await API.post('/finance/transactions', data);
        UI.closeModal('transactionModal');
        await this.loadTransactions();
        await this.loadSummary();
    },

    openEmployeeModal() { UI.openModal('employeeModal'); },

    async saveEmployee() {
        const data = {
            full_name: document.getElementById('empFullName').value,
            position: document.getElementById('empPosition').value,
            phone: document.getElementById('empPhone').value,
            email: document.getElementById('empEmail').value,
            base_salary: parseFloat(document.getElementById('empBaseSalary').value) || 0,
            hourly_rate: parseFloat(document.getElementById('empHourlyRate').value) || 0
        };
        if (!data.full_name) { alert('Введите ФИО'); return; }

        await API.post('/employees/', data);
        UI.closeModal('employeeModal');
        await this.loadEmployees();
    },

    async calculateSalary() {
        const start = document.getElementById('salaryStartDate').value;
        const end = document.getElementById('salaryEndDate').value;
        const report = await API.get(`/employees/salary-report?start_date=${start}&end_date=${end}`);

        const container = document.getElementById('salaryReport');
        container.innerHTML = `
            <table class="table">
                <thead><tr><th>Сотрудник</th><th>Должность</th><th>Оклад</th><th>Сдельно</th><th>Итого</th></tr></thead>
                <tbody>${report.map(r => `
                    <tr><td>${r.employee_name}</td><td>${this.getPositionName(r.position)}</td>
                    <td>${this.formatPrice(r.base_salary)}</td><td>${this.formatPrice(r.task_amount)}</td>
                    <td><strong>${this.formatPrice(r.total_salary)}</strong></td></tr>
                `).join('')}</tbody>
            </table>
        `;
    },

    applyCustomPeriod() {
        this.loadTransactions();
        this.loadSummary();
    },

    exportSalaryReport() { Toast.info('Экспорт отчёта...'); },

    getPositionName(p) {
        const names = { maid: 'Горничная', receptionist: 'Администратор', manager: 'Управляющий', technician: 'Техник' };
        return names[p] || p;
    },

    formatDate(d) { return d ? new Date(d).toLocaleDateString('ru-RU') : '—'; },
    formatPrice(p) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(p); }
};

window.FinanceManager = FinanceManager;