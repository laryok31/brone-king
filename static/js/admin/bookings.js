/**
 * Booking Manager - Управление бронированиями
 * Полностью рабочий модуль
 */

const BookingManager = {
    // Данные
    bookings: [],
    availableRooms: [],
    services: [],
    
    // Состояние
    currentFilter: 'all',
    searchQuery: '',
    sortBy: 'created_desc',
    chessboardCollapsed: false,
    
    /**
     * Инициализация
     */
    async init() {
        console.log('🚀 BookingManager init');
        
        // Устанавливаем даты по умолчанию
        this.setDefaultDates();
        this.setupChessboardDates();
        
        // Загружаем данные
        await this.loadGuests();
        await this.loadServices();
        await this.load();
        
        // Навешиваем обработчики
        this.bindEvents();
        
        // Рисуем шахматку
        setTimeout(() => this.renderChessboard(), 500);
    },
    
    /**
     * Установка дат по умолчанию для формы
     */
    setDefaultDates() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        
        if (checkIn) checkIn.value = this.formatDateForInput(today);
        if (checkOut) checkOut.value = this.formatDateForInput(tomorrow);
    },
    
    /**
     * Установка дат для шахматки
     */
    setupChessboardDates() {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        const chessCheckIn = document.getElementById('chessCheckIn');
        const chessCheckOut = document.getElementById('chessCheckOut');
        
        if (chessCheckIn) chessCheckIn.value = this.formatDateForInput(today);
        if (chessCheckOut) chessCheckOut.value = this.formatDateForInput(nextWeek);
    },
    
    /**
     * Форматирование даты для input
     */
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * Навешивание обработчиков событий
     */
    bindEvents() {
        console.log('Binding events...');
        
        // Статистика - фильтры
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.currentFilter = card.dataset.filter;
                this.renderList();
            });
        });
        
        // Фильтр-табы
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderList();
            });
        });
        
        // Поиск
        const searchInput = document.getElementById('bookingSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderList();
            });
        }
        
        // Сортировка
        const sortSelect = document.getElementById('bookingSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.sortBookings();
                this.renderList();
            });
        }
        
        // Даты формы
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        if (checkIn) checkIn.addEventListener('change', () => this.loadAvailableRooms());
        if (checkOut) checkOut.addEventListener('change', () => this.loadAvailableRooms());
        
        // Выбор номера
        const roomSelect = document.getElementById('roomSelect');
        if (roomSelect) roomSelect.addEventListener('change', () => this.calculateTotal());
        
        // Даты шахматки
        const chessCheckIn = document.getElementById('chessCheckIn');
        const chessCheckOut = document.getElementById('chessCheckOut');
        if (chessCheckIn) chessCheckIn.addEventListener('change', () => this.renderChessboard());
        if (chessCheckOut) chessCheckOut.addEventListener('change', () => this.renderChessboard());
        
        // Кнопки быстрых дат
        document.querySelectorAll('.quick-date-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const days = parseInt(btn.dataset.days);
                this.setQuickDateRange(days);
            });
        });
        
        // Кнопки шахматки
        const toggleBtn = document.getElementById('toggleChessboardBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleChessboard();
            });
        }
        
        const refreshBtn = document.getElementById('refreshChessboardBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderChessboard();
            });
        }
        
        // Заголовок шахматки
        const headerBar = document.querySelector('.chessboard-header-bar');
        if (headerBar) {
            headerBar.addEventListener('click', () => this.toggleChessboard());
        }
    },
    
    /**
     * Загрузка гостей
     */
    async loadGuests() {
        try {
            const guests = await API.get('/guests/');
            const select = document.getElementById('guestSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Выберите гостя...</option><option value="new">+ Создать нового</option>';
            guests.forEach(g => {
                select.innerHTML += `<option value="${g.id}">${g.last_name} ${g.first_name} (${g.phone || 'нет телефона'})</option>`;
            });
        } catch (e) {
            console.error('Ошибка загрузки гостей:', e);
        }
    },
    
    /**
     * Загрузка услуг
     */
    async loadServices() {
        try {
            this.services = await API.get('/services/');
            const container = document.getElementById('servicesList');
            if (!container) return;
            
            container.innerHTML = this.services.map(s => `
                <label class="service-item">
                    <input type="checkbox" name="services" value="${s.id}" data-price="${s.price}">
                    <span class="service-name">${s.name}</span>
                    <span class="service-price">${s.price}₽</span>
                </label>
            `).join('');
            
            // Навешиваем обработчики на чекбоксы услуг
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => this.calculateTotal());
            });
        } catch (e) {
            console.error('Ошибка загрузки услуг:', e);
        }
    },
    
    /**
     * Загрузка доступных номеров
     */
    async loadAvailableRooms() {
        const checkIn = document.getElementById('checkIn')?.value;
        const checkOut = document.getElementById('checkOut')?.value;
        
        if (!checkIn || !checkOut) return;
        
        try {
            this.availableRooms = await API.get(`/bookings/available-rooms?check_in=${checkIn}&check_out=${checkOut}`);
            const select = document.getElementById('roomSelect');
            if (!select) return;
            
            if (this.availableRooms.length === 0) {
                select.innerHTML = '<option value="">Нет свободных номеров</option>';
            } else {
                select.innerHTML = '<option value="">Выберите номер...</option>';
                this.availableRooms.forEach(r => {
                    select.innerHTML += `<option value="${r.id}" data-price="${r.price_per_night}" data-type="${r.room_type}" data-capacity="${r.capacity}">№${r.room_number} - ${r.room_type} (${r.price_per_night}₽/ночь)</option>`;
                });
            }
        } catch (e) {
            console.error('Ошибка загрузки номеров:', e);
        }
    },
    
    /**
     * Расчет стоимости
     */
    calculateTotal() {
        const select = document.getElementById('roomSelect');
        const selectedOption = select?.options[select.selectedIndex];
        const price = selectedOption?.dataset.price;
        const checkIn = document.getElementById('checkIn')?.value;
        const checkOut = document.getElementById('checkOut')?.value;
        
        if (!price || !checkIn || !checkOut) return;
        
        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        if (nights <= 0) return;
        
        let total = nights * parseFloat(price);
        
        // Добавляем услуги
        document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
            total += parseFloat(cb.dataset.price);
        });
        
        document.getElementById('nightsCount').textContent = nights;
        document.getElementById('pricePerNight').textContent = this.formatPrice(price);
        document.getElementById('totalAmount').textContent = this.formatPrice(total);
        document.getElementById('priceBox').style.display = 'block';
        
        // Информация о номере
        const infoBox = document.getElementById('roomInfo');
        if (infoBox) {
            infoBox.style.display = 'block';
            infoBox.innerHTML = `
                <div class="price-row"><span>Тип номера:</span> <span>${selectedOption.dataset.type}</span></div>
                <div class="price-row"><span>Вместимость:</span> <span>${selectedOption.dataset.capacity} чел.</span></div>
            `;
        }
    },
    
    /**
     * Загрузка бронирований
     */
    async load() {
        try {
            console.log('Loading bookings...');
            this.bookings = await API.get('/bookings/');
            console.log('Loaded', this.bookings.length, 'bookings');
            this.sortBookings();
            this.updateStats();
            this.renderList();
        } catch (e) {
            console.error('Ошибка загрузки бронирований:', e);
        }
    },
    
    /**
     * Сортировка бронирований
     */
    sortBookings() {
        switch(this.sortBy) {
            case 'created_asc':
                this.bookings.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                break;
            case 'checkin_asc':
                this.bookings.sort((a, b) => new Date(a.check_in_date) - new Date(b.check_in_date));
                break;
            case 'checkin_desc':
                this.bookings.sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date));
                break;
            case 'price_desc':
                this.bookings.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
                break;
            case 'price_asc':
                this.bookings.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
                break;
            default:
                this.bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
    },
    
    /**
     * Обновление статистики
     */
    updateStats() {
        document.getElementById('totalBookings').textContent = this.bookings.length;
        document.getElementById('pendingBookings').textContent = this.bookings.filter(b => b.status === 'pending').length;
        document.getElementById('confirmedBookings').textContent = this.bookings.filter(b => b.status === 'confirmed').length;
        document.getElementById('checkedInBookings').textContent = this.bookings.filter(b => b.status === 'checked_in').length;
        document.getElementById('checkedOutBookings').textContent = this.bookings.filter(b => b.status === 'checked_out').length;
    },
    
    /**
     * Отрисовка списка
     */
    /**
     * Отрисовка списка - ИСПРАВЛЕННАЯ ВЕРСИЯ
     */
    renderList() {
        const container = document.getElementById('bookingsList');
        if (!container) return;

        let filtered = [...this.bookings];

        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(b => b.status === this.currentFilter);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(b =>
                (b.booking_number || '').toLowerCase().includes(this.searchQuery) ||
                String(b.room_id).includes(this.searchQuery) ||
                String(b.guest_id).includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Нет бронирований</p></div>';
            return;
        }

        // Рендерим все элементы
        let html = '';
        filtered.forEach(b => {
            html += this.renderBookingItem(b);
        });
        container.innerHTML = html;

        // ВАЖНО: Навешиваем обработчики клика на каждую строку
        const items = container.querySelectorAll('.booking-item');
        items.forEach((item, index) => {
            const booking = filtered[index];

            // Основной клик по строке
            item.addEventListener('click', (e) => {
                // Проверяем, что клик не по кнопке
                if (!e.target.closest('button') && !e.target.closest('.btn-icon')) {
                    console.log('Clicked booking:', booking.id);
                    this.showBookingDetail(booking.id);
                }
            });

            // Добавляем data-атрибут
            item.dataset.bookingId = booking.id;
            // Добавляем класс для визуального отклика
            item.style.cursor = 'pointer';
        });

        // Навешиваем обработчики на кнопки внутри строк
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = parseInt(btn.dataset.id);

                if (action === 'checkin') this.checkIn(id);
                else if (action === 'checkout') this.checkOut(id);
                else if (action === 'cancel') this.cancel(id);
            });
        });

        console.log(`Rendered ${items.length} bookings`);
    },
    
    /**
     * Отрисовка одного бронирования
     */
    renderBookingItem(booking) {
        const statuses = {
            'pending': { class: 'status-pending', text: 'Ожидает' },
            'confirmed': { class: 'status-confirmed', text: 'Подтверждено' },
            'checked_in': { class: 'status-checked_in', text: 'Заселен' },
            'checked_out': { class: 'status-checked_out', text: 'Выехал' },
            'cancelled': { class: 'status-cancelled', text: 'Отменен' }
        };
        
        const status = statuses[booking.status] || statuses.pending;
        const progress = booking.total_amount > 0 ? (booking.paid_amount / booking.total_amount) * 100 : 0;
        const nights = Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / (1000 * 60 * 60 * 24));
        
        let actions = '';
        if (booking.status === 'confirmed') {
            actions += `<button class="btn-icon success" data-action="checkin" data-id="${booking.id}" title="Заселить"><i class="fas fa-sign-in-alt"></i></button>`;
        }
        if (booking.status === 'checked_in') {
            actions += `<button class="btn-icon" data-action="checkout" data-id="${booking.id}" title="Выселить"><i class="fas fa-sign-out-alt"></i></button>`;
        }
        if (booking.status !== 'cancelled' && booking.status !== 'checked_out') {
            actions += `<button class="btn-icon danger" data-action="cancel" data-id="${booking.id}" title="Отменить"><i class="fas fa-times"></i></button>`;
        }
        
        return `
            <div class="booking-item" data-booking-id="${booking.id}">
                <div class="booking-main">
                    <div class="booking-header">
                        <span class="booking-number">${booking.booking_number || 'Без номера'}</span>
                        <span class="status-badge ${status.class}">${status.text}</span>
                    </div>
                    <div class="booking-guest">
                        <i class="fas fa-user"></i> Гость #${booking.guest_id}
                        <span class="booking-room"><i class="fas fa-door-open"></i> Номер #${booking.room_id}</span>
                    </div>
                    <div class="booking-dates">
                        <span><i class="far fa-calendar"></i> ${this.formatDate(booking.check_in_date)}</span>
                        <i class="fas fa-arrow-right"></i>
                        <span>${this.formatDate(booking.check_out_date)}</span>
                        <span style="margin-left: 8px;">(${nights} ноч.)</span>
                    </div>
                    <div class="booking-footer">
                        <span class="booking-price">${this.formatPrice(booking.total_amount)}</span>
                        <div class="payment-progress">
                            <span style="font-size: 12px; color: #6b7280;">${this.formatPrice(booking.paid_amount)}</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="booking-right">
                    <div class="booking-actions">
                        ${actions}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Отрисовка шахматки
     */
    async renderChessboard() {
        const container = document.getElementById('chessboardContainer');
        if (!container) return;

        let checkIn = document.getElementById('chessCheckIn')?.value;
        let checkOut = document.getElementById('chessCheckOut')?.value;

        if (!checkIn) checkIn = document.getElementById('checkIn')?.value;
        if (!checkOut) checkOut = document.getElementById('checkOut')?.value;

        if (!checkIn || !checkOut) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar"></i><p>Выберите даты</p></div>';
            return;
        }

        container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Загрузка шахматки...</p></div>';

        try {
            const rooms = await API.get('/rooms/');
            const bookings = await API.get('/bookings/');

            const start = new Date(checkIn);
            const end = new Date(checkOut);
            const days = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                days.push(new Date(d));
            }

            // Создаем таблицу
            let html = '<div class="chessboard">';

            // Заголовок таблицы
            html += '<div class="chessboard-header">';
            html += '<div class="chessboard-cell room-cell">Номер</div>';
            days.forEach(day => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                html += `<div class="chessboard-cell" style="${isWeekend ? 'background: #fef3c7;' : ''}">${day.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'})}<br><small>${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][day.getDay()]}</small></div>`;
            });
            html += '</div>';

            // Строки с номерами
            rooms.forEach(room => {
                html += '<div class="chessboard-row">';
                html += `<div class="chessboard-cell room-cell">№${room.room_number}<br><small>${this.getRoomTypeName(room.room_type)}</small></div>`;

                days.forEach(day => {
                    const dateStr = day.toISOString().split('T')[0];
                    const booking = bookings.find(b =>
                        b.room_id === room.id &&
                        b.status !== 'cancelled' &&
                        new Date(b.check_in_date) <= day &&
                        new Date(b.check_out_date) > day
                    );

                    let cellClass = 'chessboard-cell ';
                    let content = '';
                    let onclick = '';

                    if (room.status === 'maintenance') {
                        cellClass += 'cell-maintenance';
                        content = '🔧';
                    } else if (room.status === 'cleaning') {
                        cellClass += 'cell-cleaning';
                        content = '🧹';
                    } else if (booking) {
                        if (booking.status === 'checked_in') {
                            cellClass += 'cell-occupied';
                            content = '👤';
                        } else {
                            cellClass += 'cell-booked';
                            content = '📅';
                        }
                        onclick = `BookingManager.showBookingDetail(${booking.id})`;
                    } else {
                        cellClass += 'cell-available';
                        content = '✓';
                        onclick = `BookingManager.quickBookFromChessboard(${room.id}, '${dateStr}')`;
                    }

                    html += `<div class="${cellClass}" onclick="${onclick}">${content}</div>`;
                });

                html += '</div>';
            });

            html += '</div>';

            // Легенда
            html += `
                <div class="chessboard-legend">
                    <div class="legend-item"><div class="legend-color" style="background: #d1fae5;"></div> Свободно</div>
                    <div class="legend-item"><div class="legend-color" style="background: #dbeafe;"></div> Забронировано</div>
                    <div class="legend-item"><div class="legend-color" style="background: #fee2e2;"></div> Заселено</div>
                    <div class="legend-item"><div class="legend-color" style="background: #fef3c7;"></div> Уборка</div>
                    <div class="legend-item"><div class="legend-color" style="background: #e5e7eb;"></div> Ремонт</div>
                </div>
            `;

            container.innerHTML = html;
        } catch (e) {
            console.error('Ошибка загрузки шахматки:', e);
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки</p></div>';
        }
    },
    
    /**
     * Быстрое бронирование из шахматки
     */
    quickBookFromChessboard(roomId, dateStr) {
        document.getElementById('checkIn').value = dateStr;
        
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        document.getElementById('checkOut').value = this.formatDateForInput(nextDay);
        
        this.loadAvailableRooms().then(() => {
            document.getElementById('roomSelect').value = roomId;
            this.calculateTotal();
            
            document.querySelector('.bookings-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        
        alert(`✅ Дата заезда: ${this.formatDate(dateStr)}`);
    },
    
    /**
     * Показать детали бронирования
     */
    /**
     * Показать детали бронирования - УЛУЧШЕННАЯ ВЕРСИЯ
     */
    showBookingDetail(id) {
        const booking = this.bookings.find(b => b.id === id);
        if (!booking) return;

        const panel = document.getElementById('bookingDetailPanel');
        if (!panel) return;

        const progress = booking.total_amount > 0 ? (booking.paid_amount / booking.total_amount) * 100 : 0;
        const nights = Math.ceil((new Date(booking.check_out_date) - new Date(booking.check_in_date)) / (1000 * 60 * 60 * 24));
        const statusColors = {
            'pending': { bg: '#fef3c7', text: '#92400e', icon: 'clock' },
            'confirmed': { bg: '#d1fae5', text: '#065f46', icon: 'check-circle' },
            'checked_in': { bg: '#dbeafe', text: '#1e40af', icon: 'sign-in-alt' },
            'checked_out': { bg: '#e5e7eb', text: '#374151', icon: 'sign-out-alt' },
            'cancelled': { bg: '#fee2e2', text: '#991b1b', icon: 'times-circle' }
        };

        const status = statusColors[booking.status] || statusColors.pending;
        const paidStatus = booking.paid_amount >= booking.total_amount ? 'Оплачено полностью' :
                          booking.paid_amount > 0 ? 'Частичная оплата' : 'Не оплачено';
        const paidIcon = booking.paid_amount >= booking.total_amount ? '✅' :
                         booking.paid_amount > 0 ? '⚠️' : '❌';

        panel.innerHTML = `
            <div class="booking-detail-panel">
                <div class="booking-detail-header">
                    <div>
                        <h3>
                            Бронирование #${booking.booking_number || 'Без номера'}
                            <span style="background: ${status.bg}; color: ${status.text}; padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-left: 12px;">
                                <i class="fas fa-${status.icon}"></i> ${this.getStatusText(booking.status)}
                            </span>
                        </h3>
                        <p style="color: #6b7280; margin-top: 4px;">
                            <i class="far fa-calendar"></i> Создано: ${this.formatDateTime(booking.created_at)}
                        </p>
                    </div>
                    <div class="booking-detail-actions-top">
                        <button class="btn-icon" onclick="BookingManager.editBooking(${booking.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="document.getElementById('bookingDetailPanel').innerHTML = ''" title="Закрыть">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div class="booking-detail-grid">
                    <div class="detail-item">
                        <label><i class="fas fa-user"></i> Гость</label>
                        <p>#${booking.guest_id} ${booking.guest_name || ''}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-door-open"></i> Номер</label>
                        <p>#${booking.room_id} (${this.getRoomTypeName(booking.room_type) || '—'})</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-users"></i> Гостей</label>
                        <p>${booking.adults || 2} взр. ${booking.children ? '+ ' + booking.children + ' дет.' : ''}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-calendar-alt"></i> Заезд</label>
                        <p>${this.formatDate(booking.check_in_date)}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-calendar-check"></i> Выезд</label>
                        <p>${this.formatDate(booking.check_out_date)}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-moon"></i> Ночей</label>
                        <p>${nights} ${this.getNightsWord(nights)}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-globe"></i> Источник</label>
                        <p>${this.getSourceName(booking.source)}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-ruble-sign"></i> Сумма</label>
                        <p style="font-size: 20px; font-weight: 700; color: #6366f1;">${this.formatPrice(booking.total_amount)}</p>
                    </div>
                    <div class="detail-item">
                        <label><i class="fas fa-credit-card"></i> Оплачено</label>
                        <p>${this.formatPrice(booking.paid_amount)}</p>
                    </div>
                </div>

                <div class="payment-section">
                    <div class="payment-header">
                        <span>
                            <i class="fas fa-wallet"></i> Статус оплаты
                            <span style="margin-left: 8px;">${paidIcon} ${paidStatus}</span>
                        </span>
                        <span style="font-weight: 600;">${Math.round(progress)}%</span>
                    </div>
                    <div class="payment-progress-large">
                        <div class="payment-progress-fill" style="width: ${progress}%;"></div>
                    </div>

                    <div class="payment-quick-actions">
                        <button class="btn btn-outline btn-sm" onclick="BookingManager.addPayment(${booking.id})">
                            <i class="fas fa-plus"></i> Добавить оплату
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="BookingManager.sendPaymentLink(${booking.id})">
                            <i class="fas fa-link"></i> Отправить ссылку
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="BookingManager.markAsPaid(${booking.id})">
                            <i class="fas fa-check-double"></i> Оплачено полностью
                        </button>
                    </div>
                </div>

                ${booking.special_requests ? `
                <div class="comments-section">
                    <label><i class="fas fa-comment"></i> Особые пожелания</label>
                    <div class="comment-item">
                        <div class="comment-text">${booking.special_requests}</div>
                    </div>
                </div>
                ` : ''}

                <div class="detail-actions">
                    ${booking.status === 'confirmed' ?
                        `<button class="btn btn-primary" onclick="BookingManager.checkIn(${booking.id})"><i class="fas fa-sign-in-alt"></i> Заселить сейчас</button>` : ''}
                    ${booking.status === 'checked_in' ?
                        `<button class="btn btn-primary" onclick="BookingManager.checkOut(${booking.id})"><i class="fas fa-sign-out-alt"></i> Выселить</button>` : ''}
                    ${booking.status !== 'cancelled' && booking.status !== 'checked_out' ?
                        `<button class="btn btn-outline" style="color: #ef4444;" onclick="BookingManager.cancel(${booking.id})"><i class="fas fa-ban"></i> Отменить бронь</button>` : ''}
                    <button class="btn btn-outline" onclick="BookingManager.printBooking(${booking.id})">
                        <i class="fas fa-print"></i> Печать
                    </button>
                    <button class="btn btn-outline" onclick="BookingManager.sendConfirmation(${booking.id})">
                        <i class="fas fa-envelope"></i> Отправить подтверждение
                    </button>
                </div>
            </div>
        `;

        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    // Вспомогательные методы
    getNightsWord(nights) {
        if (nights % 10 === 1 && nights % 100 !== 11) return 'ночь';
        if ([2, 3, 4].includes(nights % 10) && ![12, 13, 14].includes(nights % 100)) return 'ночи';
        return 'ночей';
    },

    getSourceName(source) {
        const sources = {
            'direct': 'Прямое', 'booking': 'Booking.com', 'ostrovok': 'Ostrovok',
            'phone': 'По телефону', 'other': 'Другое'
        };
        return sources[source] || source || '—';
    },

    addPayment(id) {
        const amount = prompt('Сумма оплаты (₽):');
        if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
            const booking = this.bookings.find(b => b.id === id);
            if (booking) {
                booking.paid_amount = (booking.paid_amount || 0) + parseFloat(amount);
                API.put(`/bookings/${id}`, { paid_amount: booking.paid_amount }).then(() => {
                    this.showBookingDetail(id);
                    alert('✅ Оплата добавлена');
                });
            }
        }
    },

    markAsPaid(id) {
        const booking = this.bookings.find(b => b.id === id);
        if (booking) {
            API.put(`/bookings/${id}`, { paid_amount: booking.total_amount }).then(() => {
                this.showBookingDetail(id);
                alert('✅ Отмечено как оплачено полностью');
            });
        }
    },

    sendPaymentLink(id) {
        alert(`📧 Ссылка на оплату отправлена гостю бронирования #${id}`);
    },

    printBooking(id) {
        alert(`🖨️ Печать бронирования #${id}`);
        // В реальном проекте - window.open(`/admin/bookings/${id}/print`);
    },

    sendConfirmation(id) {
        alert(`📧 Подтверждение отправлено гостю бронирования #${id}`);
    },
    
    /**
     * Редактирование бронирования
     */
    /**
     * Редактирование бронирования - ИСПРАВЛЕННАЯ ВЕРСИЯ
     */
    editBooking(id) {
        const booking = this.bookings.find(b => b.id === id);
        if (!booking) return;

        const panel = document.getElementById('bookingDetailPanel');

        panel.innerHTML = `
            <div class="booking-detail-panel">
                <div class="booking-detail-header">
                    <h3><i class="fas fa-edit"></i> Редактирование #${booking.booking_number}</h3>
                    <button class="btn-icon" onclick="BookingManager.showBookingDetail(${id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="edit-booking-form">
                    <div class="form-group">
                        <label class="form-label">Дата заезда</label>
                        <input type="date" class="form-control" id="editCheckIn" value="${booking.check_in_date?.split('T')[0] || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата выезда</label>
                        <input type="date" class="form-control" id="editCheckOut" value="${booking.check_out_date?.split('T')[0] || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Взрослых</label>
                        <input type="number" class="form-control" id="editAdults" value="${booking.adults || 2}" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Детей</label>
                        <input type="number" class="form-control" id="editChildren" value="${booking.children || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Сумма (₽)</label>
                        <input type="number" class="form-control" id="editTotal" value="${booking.total_amount || 0}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Оплачено (₽)</label>
                        <input type="number" class="form-control" id="editPaid" value="${booking.paid_amount || 0}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Источник</label>
                        <select class="form-control" id="editSource">
                            <option value="direct" ${booking.source === 'direct' ? 'selected' : ''}>Прямое</option>
                            <option value="booking" ${booking.source === 'booking' ? 'selected' : ''}>Booking.com</option>
                            <option value="ostrovok" ${booking.source === 'ostrovok' ? 'selected' : ''}>Ostrovok</option>
                            <option value="phone" ${booking.source === 'phone' ? 'selected' : ''}>По телефону</option>
                            <option value="other" ${booking.source === 'other' ? 'selected' : ''}>Другое</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Статус</label>
                        <select class="form-control" id="editStatus">
                            <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                            <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Подтверждено</option>
                            <option value="checked_in" ${booking.status === 'checked_in' ? 'selected' : ''}>Заселен</option>
                            <option value="checked_out" ${booking.status === 'checked_out' ? 'selected' : ''}>Выехал</option>
                            <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Отменено</option>
                        </select>
                    </div>
                    <div class="form-group edit-booking-full">
                        <label class="form-label">Особые пожелания</label>
                        <textarea class="form-control" id="editRequests" rows="2">${booking.special_requests || ''}</textarea>
                    </div>
                </div>

                <div class="detail-actions">
                    <button class="btn btn-outline" onclick="BookingManager.showBookingDetail(${id})">Отмена</button>
                    <button class="btn btn-primary" onclick="BookingManager.saveBooking(${id})">
                        <i class="fas fa-save"></i> Сохранить
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Сохранение бронирования - ИСПРАВЛЕННАЯ ВЕРСИЯ
     */
    async saveBooking(id) {
        const data = {
            check_in_date: document.getElementById('editCheckIn')?.value,
            check_out_date: document.getElementById('editCheckOut')?.value,
            adults: parseInt(document.getElementById('editAdults')?.value) || 2,
            children: parseInt(document.getElementById('editChildren')?.value) || 0,
            total_amount: parseFloat(document.getElementById('editTotal')?.value) || 0,
            paid_amount: parseFloat(document.getElementById('editPaid')?.value) || 0,
            source: document.getElementById('editSource')?.value,
            status: document.getElementById('editStatus')?.value,
            special_requests: document.getElementById('editRequests')?.value
        };

        if (!data.check_in_date || !data.check_out_date) {
            alert('❌ Выберите даты');
            return;
        }

        try {
            await API.put(`/bookings/${id}`, data);
            alert('✅ Бронирование обновлено');
            await this.load();
            this.showBookingDetail(id);
        } catch (e) {
            alert('❌ Ошибка сохранения');
            console.error(e);
        }
    },
    
    /**
     * Создание бронирования
     */
    async create() {
        const guestSelect = document.getElementById('guestSelect');
        const roomSelect = document.getElementById('roomSelect');
        const checkIn = document.getElementById('checkIn')?.value;
        const checkOut = document.getElementById('checkOut')?.value;
        
        if (!checkIn || !checkOut) { alert('Выберите даты'); return; }
        if (!roomSelect?.value) { alert('Выберите номер'); return; }
        
        let guestId = guestSelect?.value;
        
        if (guestId === 'new') {
            const lastName = document.getElementById('newLastName')?.value;
            const firstName = document.getElementById('newFirstName')?.value;
            const phone = document.getElementById('newPhone')?.value;
            
            if (!lastName || !firstName || !phone) { alert('Заполните данные гостя'); return; }
            
            try {
                const newGuest = await API.post('/guests/', {
                    last_name: lastName, first_name: firstName, phone: phone,
                    email: phone + '@temp.com'
                });
                guestId = newGuest.id;
                await this.loadGuests();
            } catch (e) { alert('Ошибка создания гостя'); return; }
        }
        
        if (!guestId) { alert('Выберите гостя'); return; }
        
        const selectedRoom = this.availableRooms.find(r => r.id == roomSelect.value);
        if (!selectedRoom) { alert('Номер не найден'); return; }
        
        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        let totalAmount = nights * selectedRoom.price_per_night;
        
        document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
            totalAmount += parseFloat(cb.dataset.price);
        });
        
        try {
            await API.post('/bookings/', {
                room_id: parseInt(roomSelect.value),
                guest_id: parseInt(guestId),
                check_in_date: checkIn,
                check_out_date: checkOut,
                adults: parseInt(document.getElementById('adults')?.value) || 2,
                children: parseInt(document.getElementById('children')?.value) || 0,
                total_amount: totalAmount,
                prepayment: parseFloat(document.getElementById('prepayment')?.value) || 0
            });
            
            alert('✅ Бронирование создано');
            await this.load();
            await this.loadAvailableRooms();
            
            // Сброс формы
            document.getElementById('guestSelect').value = '';
            document.getElementById('newGuestFields').style.display = 'none';
            document.getElementById('priceBox').style.display = 'none';
            this.setDefaultDates();
        } catch (e) {
            alert('❌ Ошибка создания');
        }
    },
    
    /**
     * Действия с бронированием
     */
    async checkIn(id) {
        if (!confirm('Заселить гостя?')) return;
        try { await API.post(`/bookings/${id}/check-in`); await this.load(); } catch (e) {}
    },
    
    async checkOut(id) {
        if (!confirm('Выселить гостя?')) return;
        try { await API.post(`/bookings/${id}/check-out`); await this.load(); } catch (e) {}
    },
    
    async cancel(id) {
        if (!confirm('Отменить бронирование?')) return;
        try { await API.delete(`/bookings/${id}`); await this.load(); } catch (e) {}
    },
    
    /**
     * Управление шахматкой
     */
    setQuickDateRange(days) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + days);
        
        document.getElementById('chessCheckIn').value = this.formatDateForInput(today);
        document.getElementById('chessCheckOut').value = this.formatDateForInput(endDate);
        
        document.querySelectorAll('.quick-date-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
        });
        
        this.renderChessboard();
    },
    
    toggleChessboard() {
        this.chessboardCollapsed = !this.chessboardCollapsed;
        const body = document.getElementById('chessboardBody');
        const icon = document.querySelector('.chessboard-collapse-icon');
        
        if (body) body.classList.toggle('collapsed', this.chessboardCollapsed);
        if (icon) icon.style.transform = this.chessboardCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    },
    
    toggleNewGuest() {
        const select = document.getElementById('guestSelect');
        const fields = document.getElementById('newGuestFields');
        if (fields) fields.style.display = select?.value === 'new' ? 'block' : 'none';
    },
    
    /**
     * Вспомогательные функции
     */
    getRoomTypeName(type) {
        const types = { 'standard': 'Стандарт', 'superior': 'Улучшенный', 'deluxe': 'Делюкс', 'suite': 'Люкс' };
        return types[type] || type;
    },
    
    formatDate(date) {
        return date ? new Date(date).toLocaleDateString('ru-RU') : '—';
    },
    
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price || 0);
    }
};

// Глобальные функции для onclick
window.BookingManager = BookingManager;

// Автоинициализация
if (document.querySelector('.bookings-page')) {
    document.addEventListener('DOMContentLoaded', () => BookingManager.init());
}