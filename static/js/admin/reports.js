const ReportsManager = {
    currentPeriod: 'month',
    charts: {},
    assistant: {
        tips: [
            { condition: (d) => d.occupancyRate < 50, message: '📉 Низкая загрузка! Рекомендуем запустить акцию или снизить цены на будние дни.', type: 'warning' },
            { condition: (d) => d.occupancyRate > 90, message: '🎉 Отличная загрузка! Подумайте о повышении цен в пиковые дни.', type: 'success' },
            { condition: (d) => d.avgCheck < 5000, message: '💰 Средний чек ниже 5000₽. Предложите гостям дополнительные услуги.', type: 'info' },
            { condition: (d) => d.cancelledRate > 20, message: '⚠️ Высокий процент отмен (>20%). Возможно, стоит ужесточить условия бронирования.', type: 'warning' },
            { condition: (d) => d.vipPercentage < 10, message: '👑 Всего ' + d.vipPercentage + '% VIP гостей. Запустите программу лояльности!', type: 'info' }
        ],

        analyze(data) {
            const tips = this.tips.filter(tip => tip.condition(data));
            return tips;
        },

        render(analysis) {
            const container = document.getElementById('assistantMessages');
            if (!container) return;

            if (analysis.length === 0) {
                container.innerHTML = `
                    <div class="assistant-message success">
                        <i class="fas fa-check-circle"></i>
                        <div>
                            <strong>Всё отлично!</strong>
                            <p>Все показатели в норме. Продолжайте в том же духе!</p>
                        </div>
                    </div>
                `;
                return;
            }

            container.innerHTML = analysis.map(tip => `
                <div class="assistant-message ${tip.type}">
                    <i class="fas fa-${tip.type === 'warning' ? 'exclamation-triangle' : tip.type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                    <div>
                        <strong>${tip.type === 'warning' ? 'Обратите внимание' : tip.type === 'success' ? 'Отлично' : 'Совет'}</strong>
                        <p>${tip.message}</p>
                    </div>
                </div>
            `).join('');
        }
    },

    async init() {
        this.setDefaultDates();
        this.bindEvents();
        await this.loadData();
        this.initCharts();
    },

    setDefaultDates() {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        document.getElementById('reportStartDate').value = this.formatDate(monthStart);
        document.getElementById('reportEndDate').value = this.formatDate(monthEnd);
    },

    bindEvents() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.setPeriodDates(this.currentPeriod);
                this.loadData();
            });
        });

        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
            });
        });
    },

    setPeriodDates(period) {
        const today = new Date();
        let start, end;

        switch(period) {
            case 'today':
                start = today;
                end = today;
                break;
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - 7);
                end = today;
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), quarter * 3, 1);
                end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
        }

        document.getElementById('reportStartDate').value = this.formatDate(start);
        document.getElementById('reportEndDate').value = this.formatDate(end);
    },

    async loadData() {
        try {
            const bookings = await API.get('/bookings/');
            const rooms = await API.get('/rooms/');
            const guests = await API.get('/guests/');

            this.updateKPIs(bookings, rooms);
            this.updateTables(bookings, rooms, guests);
            this.updateCharts(bookings);
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    },

    updateKPIs(bookings, rooms, guests) {
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
        const occupancyRate = (rooms.filter(r => r.status === 'occupied').length / rooms.length * 100) || 0;
        const avgCheck = bookings.length > 0 ? totalRevenue / bookings.length : 0;
        const cancelledRate = (bookings.filter(b => b.status === 'cancelled').length / bookings.length * 100) || 0;
        const vipGuests = guests.filter(g => g.guest_type === 'vip').length;
        const vipPercentage = guests.length > 0 ? (vipGuests / guests.length * 100) : 0;

        let totalNights = 0;
        bookings.forEach(b => {
            if (b.check_in_date && b.check_out_date) {
                totalNights += Math.ceil((new Date(b.check_out_date) - new Date(b.check_in_date)) / (1000 * 60 * 60 * 24));
            }
        });
        const avgStay = bookings.length > 0 ? totalNights / bookings.length : 0;

        document.getElementById('totalRevenue').textContent = this.formatPrice(totalRevenue);
        document.getElementById('totalBookings').textContent = bookings.length;
        document.getElementById('totalGuests').textContent = [...new Set(bookings.map(b => b.guest_id))].length;
        document.getElementById('occupancyRate').textContent = Math.round(occupancyRate) + '%';
        document.getElementById('avgCheck').textContent = this.formatPrice(avgCheck);
        document.getElementById('avgStay').textContent = avgStay.toFixed(1);

        // Изменения (заглушки)
        document.getElementById('revenueChange').textContent = '+12%';
        document.getElementById('revenueChange').className = 'kpi-change positive';
        document.getElementById('bookingsChange').textContent = '+8%';
        document.getElementById('bookingsChange').className = 'kpi-change positive';
        document.getElementById('guestsChange').textContent = '+5%';
        document.getElementById('guestsChange').className = 'kpi-change positive';
        document.getElementById('occupancyChange').textContent = '+3%';
        document.getElementById('occupancyChange').className = 'kpi-change positive';
        document.getElementById('avgCheckChange').textContent = '+4%';
        document.getElementById('avgCheckChange').className = 'kpi-change positive';

        // Запускаем помощника
        const analysis = this.assistant.analyze({
            occupancyRate, avgCheck, cancelledRate, vipPercentage: Math.round(vipPercentage)
        });
        this.assistant.render(analysis);
    },

    updateTables(bookings, rooms, guests) {
        // Таблица доходов по месяцам
        const revenueByMonth = {};
        bookings.forEach(b => {
            if (b.created_at) {
                const month = new Date(b.created_at).toLocaleDateString('ru-RU', { month: 'long' });
                if (!revenueByMonth[month]) revenueByMonth[month] = { count: 0, revenue: 0, nights: 0 };
                revenueByMonth[month].count++;
                revenueByMonth[month].revenue += b.total_amount || 0;
                if (b.check_in_date && b.check_out_date) {
                    revenueByMonth[month].nights += Math.ceil((new Date(b.check_out_date) - new Date(b.check_in_date)) / (1000 * 60 * 60 * 24));
                }
            }
        });

        const revenueTable = document.getElementById('revenueTable');
        if (Object.keys(revenueByMonth).length === 0) {
            revenueTable.innerHTML = '<tr><td colspan="6" class="text-center">Нет данных за период</td></tr>';
        } else {
            revenueTable.innerHTML = Object.entries(revenueByMonth).map(([month, data]) => `
                <tr>
                    <td>${month}</td>
                    <td>${data.count}</td>
                    <td>${data.nights}</td>
                    <td>${this.formatPrice(data.revenue)}</td>
                    <td>${this.formatPrice(data.revenue / data.count)}</td>
                    <td>—</td>
                </tr>
            `).join('');
        }

        // Таблица бронирований
        const bookingsTable = document.getElementById('bookingsTable');
        const recentBookings = bookings.slice(-10).reverse();
        if (recentBookings.length === 0) {
            bookingsTable.innerHTML = '<tr><td colspan="7" class="text-center">Нет бронирований</td></tr>';
        } else {
            bookingsTable.innerHTML = recentBookings.map(b => `
                <tr>
                    <td><strong>${b.booking_number || '—'}</strong></td>
                    <td>Гость #${b.guest_id}</td>
                    <td>Номер #${b.room_id}</td>
                    <td>${this.formatDate(b.check_in_date)} - ${this.formatDate(b.check_out_date)}</td>
                    <td>${this.formatPrice(b.total_amount)}</td>
                    <td><span class="status-badge status-${b.status}">${this.getStatusText(b.status)}</span></td>
                    <td>${this.getSourceName(b.source)}</td>
                </tr>
            `).join('');
        }

        // Таблица номеров
        const roomsTable = document.getElementById('roomsTable');
        const roomStats = rooms.map(r => {
            const roomBookings = bookings.filter(b => b.room_id === r.id);
            const revenue = roomBookings.reduce((s, b) => s + (b.total_amount || 0), 0);
            let nights = 0;
            roomBookings.forEach(b => {
                if (b.check_in_date && b.check_out_date) {
                    nights += Math.ceil((new Date(b.check_out_date) - new Date(b.check_in_date)) / (1000 * 60 * 60 * 24));
                }
            });
            return { ...r, bookings: roomBookings.length, revenue, nights };
        }).sort((a, b) => b.revenue - a.revenue);

        roomsTable.innerHTML = roomStats.map(r => `
            <tr>
                <td><strong>${r.room_number}</strong></td>
                <td>${this.getRoomTypeName(r.room_type)}</td>
                <td>${r.bookings}</td>
                <td>${r.nights}</td>
                <td>${this.formatPrice(r.revenue)}</td>
                <td>${r.status === 'occupied' ? '🔴 Занят' : '🟢 Свободен'}</td>
            </tr>
        `).join('');

        // Таблица гостей
        const guestsTable = document.getElementById('guestsTable');
        const guestStats = guests.map(g => {
            const guestBookings = bookings.filter(b => b.guest_id === g.id);
            const revenue = guestBookings.reduce((s, b) => s + (b.total_amount || 0), 0);
            let nights = 0;
            guestBookings.forEach(b => {
                if (b.check_in_date && b.check_out_date) {
                    nights += Math.ceil((new Date(b.check_out_date) - new Date(b.check_in_date)) / (1000 * 60 * 60 * 24));
                }
            });
            const lastVisit = guestBookings.length > 0 ?
                guestBookings.sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date))[0].check_in_date : null;
            return { ...g, bookings: guestBookings.length, revenue, nights, lastVisit };
        }).sort((a, b) => b.revenue - a.revenue);

        guestsTable.innerHTML = guestStats.slice(0, 15).map(g => `
            <tr>
                <td><strong>${g.last_name} ${g.first_name}</strong></td>
                <td>${g.bookings}</td>
                <td>${g.nights}</td>
                <td>${this.formatPrice(g.revenue)}</td>
                <td>${g.lastVisit ? this.formatDate(g.lastVisit) : '—'}</td>
                <td>${g.guest_type === 'vip' ? '<span class="badge badge-warning">👑 VIP</span>' : '<span class="badge">Обычный</span>'}</td>
            </tr>
        `).join('');
    },

    getStatusText(status) {
        const texts = {
            'pending': 'Ожидает', 'confirmed': 'Подтверждено',
            'checked_in': 'Заселен', 'checked_out': 'Выехал', 'cancelled': 'Отменено'
        };
        return texts[status] || status;
    },

    getSourceName(source) {
        const sources = {
            'direct': 'Прямое', 'booking': 'Booking.com', 'ostrovok': 'Ostrovok',
            'phone': 'По телефону', 'other': 'Другое'
        };
        return sources[source] || source || '—';
    },

    getRoomTypeName(type) {
        const types = { 'standard': 'Стандарт', 'superior': 'Улучшенный', 'deluxe': 'Делюкс', 'suite': 'Люкс' };
        return types[type] || type;
    },

    initCharts() {
        // График выручки
        const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
        if (revenueCtx) {
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'bar',
                data: {
                    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
                    datasets: [{
                        label: 'Выручка (₽)',
                        data: [980000, 1120000, 1420000, 1560000, 1800000, 2100000],
                        backgroundColor: '#6366f1',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // График источников
        const sourcesCtx = document.getElementById('sourcesChart')?.getContext('2d');
        if (sourcesCtx) {
            this.charts.sources = new Chart(sourcesCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Прямые', 'Booking', 'Ostrovok', 'Телефон', 'Другое'],
                    datasets: [{
                        data: [45, 25, 15, 10, 5],
                        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // График номеров
        const roomsCtx = document.getElementById('roomsChart')?.getContext('2d');
        if (roomsCtx) {
            this.charts.rooms = new Chart(roomsCtx, {
                type: 'bar',
                data: {
                    labels: ['Стандарт', 'Улучшенный', 'Люкс', 'Семейный'],
                    datasets: [{
                        label: 'Бронирований',
                        data: [45, 30, 20, 10],
                        backgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // График загрузки
        const occupancyCtx = document.getElementById('occupancyChart')?.getContext('2d');
        if (occupancyCtx) {
            this.charts.occupancy = new Chart(occupancyCtx, {
                type: 'line',
                data: {
                    labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                    datasets: [{
                        label: 'Загрузка (%)',
                        data: [65, 70, 75, 80, 85, 90, 85],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    },

    updateCharts(bookings) {
        // Обновление графиков при смене периода
    },

    applyCustomPeriod() {
        this.loadData();
    },

    exportPDF() {
        alert('📄 Экспорт в PDF');
    },

    exportExcel() {
        alert('📊 Экспорт в Excel');
    },

    print() {
        window.print();
    },

    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price);
    }
};

window.ReportsManager = ReportsManager;