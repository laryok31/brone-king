const DashboardManager = {
    settings: {
        showRevenueChart: true,
        showPopularRooms: true,
        showInventory: true,
        showFinance: true,
        refreshInterval: 30
    },
    
    charts: {},
    
    async init() {
        this.loadSettings();
        await this.loadData();
        this.bindEvents();
        this.startAutoRefresh();
        this.showWelcomeTour();
    },
    
    loadSettings() {
        const saved = localStorage.getItem('dashboardSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this.applySettings();
    },
    
    saveSettings() {
        localStorage.setItem('dashboardSettings', JSON.stringify(this.settings));
    },
    
    applySettings() {
        document.getElementById('showRevenueChart').checked = this.settings.showRevenueChart;
        document.getElementById('showPopularRooms').checked = this.settings.showPopularRooms;
        document.getElementById('showInventory').checked = this.settings.showInventory;
        document.getElementById('showFinance').checked = this.settings.showFinance;
        document.getElementById('refreshInterval').value = this.settings.refreshInterval;
    },
    
    bindEvents() {
        // Кнопка настроек
        document.getElementById('settingsToggle')?.addEventListener('click', () => {
            document.getElementById('settingsPanel').classList.toggle('active');
        });
        
        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settingsPanel');
            const btn = document.getElementById('settingsToggle');
            if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
                panel.classList.remove('active');
            }
        });
        
        // Сохранение настроек
        document.querySelectorAll('.settings-option input').forEach(input => {
            input.addEventListener('change', () => {
                this.settings[input.id] = input.type === 'checkbox' ? input.checked : parseInt(input.value);
                this.saveSettings();
                this.refreshLayout();
            });
        });
        
        // Клики по KPI
        document.querySelectorAll('[data-kpi-link]').forEach(kpi => {
            kpi.addEventListener('click', () => {
                const link = kpi.dataset.kpiLink;
                if (link) window.location.href = link;
            });
        });
    },
    
    async loadData() {
        try {
            UI.showLoading();
            const data = await API.get('/admin/dashboard/full');
            this.renderStats(data.stats);
            this.renderRevenueChart(data.revenue_chart);
            this.renderPopularRooms(data.popular_rooms);
            this.renderRecentBookings(data.recent_bookings);
            this.renderTransactions(data.recent_transactions);
            this.renderMovements(data.recent_movements);
            this.updateWelcome(data.stats);
        } catch (e) {
            console.error('Ошибка загрузки дашборда:', e);
        } finally {
            UI.hideLoading();
        }
    },
    
    renderStats(stats) {
        document.getElementById('totalRooms').textContent = stats.total_rooms;
        document.getElementById('occupiedRooms').textContent = stats.occupied_rooms;
        document.getElementById('occupancyRate').textContent = stats.occupancy_rate + '%';
        document.getElementById('totalGuests').textContent = stats.total_guests;
        document.getElementById('activeBookings').textContent = stats.active_bookings;
        document.getElementById('monthRevenue').textContent = this.formatPrice(stats.month_revenue);
        document.getElementById('inventoryValue').textContent = this.formatPrice(stats.inventory_value);
        document.getElementById('monthBalance').textContent = this.formatPrice(stats.month_balance);
        
        // Тренды
        document.getElementById('lowStockCount').textContent = stats.low_stock_count;
        document.getElementById('todayCheckins').textContent = stats.today_checkins;
        document.getElementById('todayCheckouts').textContent = stats.today_checkouts;
    },
    
    renderRevenueChart(data) {
        const ctx = document.getElementById('revenueChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Выручка (₽)',
                    data: data.map(d => d.revenue),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        titleColor: '#fbbf24',
                        bodyColor: '#e5e7eb'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' },
                        ticks: {
                            callback: (value) => this.formatPrice(value).replace('₽', '') + '₽'
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    renderPopularRooms(rooms) {
        const container = document.getElementById('popularRoomsList');
        if (!container) return;
        
        if (!rooms.length) {
            container.innerHTML = '<div class="empty-state"><p>Нет данных</p></div>';
            return;
        }
        
        container.innerHTML = rooms.map((room, index) => {
            let rankClass = '';
            if (index === 0) rankClass = 'top1';
            else if (index === 1) rankClass = 'top2';
            else if (index === 2) rankClass = 'top3';
            
            return `
                <div class="popular-item">
                    <div class="popular-rank ${rankClass}">${index + 1}</div>
                    <div class="popular-info">
                        <div class="popular-name">Номер ${room.room_number}</div>
                        <div class="popular-stats">${room.bookings} бронирований</div>
                    </div>
                    <div class="popular-value">${((room.bookings / (rooms[0]?.bookings || 1)) * 100).toFixed(0)}%</div>
                </div>
            `;
        }).join('');
    },
    
    renderRecentBookings(bookings) {
        const container = document.getElementById('recentBookingsList');
        if (!container) return;
        
        if (!bookings.length) {
            container.innerHTML = '<div class="empty-state"><p>Нет бронирований</p></div>';
            return;
        }
        
        container.innerHTML = bookings.slice(0, 5).map(b => `
            <div class="activity-item" onclick="window.location.href='/admin/bookings'">
                <div class="activity-icon" style="background: ${b.status === 'confirmed' ? '#10b981' : b.status === 'checked_in' ? '#3b82f6' : '#f59e0b'};">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${b.booking_number || 'Бронь'}</div>
                    <div class="activity-time">Гость #${b.guest_id} • Номер #${b.room_id}</div>
                </div>
                <div class="activity-amount income">${this.formatPrice(b.total_amount)}</div>
            </div>
        `).join('');
    },
    
    renderTransactions(transactions) {
        const container = document.getElementById('recentTransactionsList');
        if (!container) return;
        
        if (!transactions.length) {
            container.innerHTML = '<div class="empty-state"><p>Нет транзакций</p></div>';
            return;
        }
        
        container.innerHTML = transactions.map(t => `
            <div class="activity-item" onclick="window.location.href='/admin/finance'">
                <div class="activity-icon" style="background: ${t.type === 'income' ? '#10b981' : '#ef4444'};">
                    <i class="fas fa-${t.type === 'income' ? 'arrow-up' : 'arrow-down'}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${t.category}</div>
                    <div class="activity-time">${this.formatDate(t.date)}</div>
                </div>
                <div class="activity-amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${this.formatPrice(t.amount)}</div>
            </div>
        `).join('');
    },
    
    renderMovements(movements) {
        const container = document.getElementById('recentMovementsList');
        if (!container) return;
        
        if (!movements.length) {
            container.innerHTML = '<div class="empty-state"><p>Нет движений</p></div>';
            return;
        }
        
        container.innerHTML = movements.map(m => `
            <div class="activity-item" onclick="window.location.href='/admin/inventory'">
                <div class="activity-icon" style="background: ${m.type === 'in' ? '#10b981' : '#ef4444'};">
                    <i class="fas fa-box"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${m.item}</div>
                    <div class="activity-time">${m.type === 'in' ? 'Приход' : 'Расход'} • ${m.quantity} шт</div>
                </div>
                <div class="activity-time">${this.formatDate(m.date)}</div>
            </div>
        `).join('');
    },
    
    updateWelcome(stats) {
        const hour = new Date().getHours();
        let greeting = 'Добрый вечер';
        if (hour < 12) greeting = 'Доброе утро';
        else if (hour < 18) greeting = 'Добрый день';
        
        document.getElementById('greetingText').textContent = greeting;
        document.getElementById('todaySummary').textContent = 
            `Сегодня: ${stats.today_checkins} заездов, ${stats.today_checkouts} выездов`;
    },
    
    refreshLayout() {
        document.getElementById('revenueChartCard').style.display = this.settings.showRevenueChart ? 'block' : 'none';
        document.getElementById('popularRoomsCard').style.display = this.settings.showPopularRooms ? 'block' : 'none';
        document.getElementById('inventoryKPI').style.display = this.settings.showInventory ? 'block' : 'none';
        document.getElementById('financeKPI').style.display = this.settings.showFinance ? 'block' : 'none';
    },
    
    startAutoRefresh() {
        setInterval(() => {
            this.loadData();
        }, this.settings.refreshInterval * 1000);
    },
    
    showWelcomeTour() {
        const seen = localStorage.getItem('dashboardTourSeen');
        if (seen) return;
        
        setTimeout(() => {
            alert('🎯 Добро пожаловать в дашборд!\n\n' +
                  '• Кликайте на KPI для быстрого перехода\n' +
                  '• Настройте отображение в панели справа внизу\n' +
                  '• Все данные обновляются автоматически');
            localStorage.setItem('dashboardTourSeen', 'true');
        }, 1000);
    },
    
    formatDate(date) {
        return date ? new Date(date).toLocaleDateString('ru-RU') : '—';
    },
    
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price);
    }
};

window.DashboardManager = DashboardManager;