const GuestManager = {
    guests: [],
    selectedGuest: null,
    currentFilter: 'all',
    searchQuery: '',
    sortBy: 'created_desc',

    async init() {
        await this.load();
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('guestSearch')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderList();
        });

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderList();
            });
        });

        document.getElementById('guestSort')?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.sortGuests();
            this.renderList();
        });
    },

    async load() {
        try {
            this.guests = await API.get('/guests/');
            this.sortGuests();
            this.updateStats();
            this.renderList();
        } catch (e) {
            console.error('Ошибка загрузки гостей:', e);
        }
    },

    sortGuests() {
        switch(this.sortBy) {
            case 'name_asc':
                this.guests.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
                break;
            case 'name_desc':
                this.guests.sort((a, b) => `${b.last_name} ${b.first_name}`.localeCompare(`${a.last_name} ${a.first_name}`));
                break;
            case 'stays_desc':
                this.guests.sort((a, b) => (b.total_stays || 0) - (a.total_stays || 0));
                break;
            case 'spent_desc':
                this.guests.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
                break;
            default:
                this.guests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
    },

    updateStats() {
        document.getElementById('totalGuests').textContent = this.guests.length;
        document.getElementById('vipGuests').textContent = this.guests.filter(g => g.guest_type === 'vip').length;
        document.getElementById('regularGuests').textContent = this.guests.filter(g => (g.total_stays || 0) >= 5).length;
        document.getElementById('blacklistedGuests').textContent = this.guests.filter(g => g.blacklisted).length;
    },

    renderList() {
        const container = document.getElementById('guestsList');
        if (!container) return;

        let filtered = this.guests;

        if (this.currentFilter === 'vip') {
            filtered = filtered.filter(g => g.guest_type === 'vip');
        } else if (this.currentFilter === 'regular') {
            filtered = filtered.filter(g => (g.total_stays || 0) >= 5);
        } else if (this.currentFilter === 'blacklisted') {
            filtered = filtered.filter(g => g.blacklisted);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(g =>
                `${g.last_name} ${g.first_name}`.toLowerCase().includes(this.searchQuery) ||
                (g.phone || '').includes(this.searchQuery) ||
                (g.email || '').toLowerCase().includes(this.searchQuery)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Гости не найдены</p></div>';
            return;
        }

        container.innerHTML = filtered.map(g => this.renderGuestItem(g)).join('');
    },

    renderGuestItem(guest) {
        const avatarClass = guest.guest_type === 'vip' ? 'vip' : (guest.blacklisted ? 'blacklisted' : '');
        const initials = `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`;

        return `
            <div class="guest-item ${this.selectedGuest === guest.id ? 'active' : ''}" onclick="GuestManager.select(${guest.id})">
                <div class="guest-avatar ${avatarClass}">${initials}</div>
                <div class="guest-info">
                    <div class="guest-name">
                        ${guest.last_name} ${guest.first_name}
                        ${guest.guest_type === 'vip' ? '<i class="fas fa-crown" style="color: #fbbf24;"></i>' : ''}
                        ${guest.blacklisted ? '<i class="fas fa-ban" style="color: #ef4444;"></i>' : ''}
                    </div>
                    <div class="guest-phone">${guest.phone || 'Нет телефона'}</div>
                </div>
                <div class="guest-badges">
                    ${(guest.total_stays || 0) >= 5 ? '<span class="badge" style="background: #dbeafe; color: #1e40af;">Постоянный</span>' : ''}
                </div>
            </div>
        `;
    },

    async select(id) {
        this.selectedGuest = id;
        this.renderList();

        const guest = this.guests.find(g => g.id === id);
        if (!guest) return;

        const container = document.getElementById('guestDetailContent');
        const initials = `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`;
        const avatarClass = guest.guest_type === 'vip' ? 'vip' : (guest.blacklisted ? 'blacklisted' : '');

        let bookingsHistory = '';
        try {
            const bookings = await API.get(`/bookings/?guest_id=${id}`);
            if (bookings.length > 0) {
                bookingsHistory = bookings.slice(0, 5).map(b => `
                    <div class="booking-history-item">
                        <div class="booking-history-header">
                            <strong>${b.booking_number || 'Без номера'}</strong>
                            <span class="status-badge status-${b.status}">${this.getStatusText(b.status)}</span>
                        </div>
                        <div class="booking-history-dates">
                            ${this.formatDate(b.check_in_date)} - ${this.formatDate(b.check_out_date)}
                        </div>
                        <div class="booking-history-footer">
                            <span>Номер #${b.room_id}</span>
                            <strong>${this.formatPrice(b.total_amount)}</strong>
                        </div>
                    </div>
                `).join('');
            } else {
                bookingsHistory = '<p style="color: #9ca3af; text-align: center; padding: 20px;">Нет истории бронирований</p>';
            }
        } catch (e) {
            bookingsHistory = '<p style="color: #9ca3af;">Ошибка загрузки</p>';
        }

        container.innerHTML = `
            <div class="guest-profile">
                <div class="guest-profile-avatar ${avatarClass}">${initials}</div>
                <div class="guest-profile-info">
                    <h2>${guest.last_name} ${guest.first_name} ${guest.middle_name || ''}</h2>
                    <div class="guest-contact">
                        <span><i class="fas fa-phone"></i> ${guest.phone || '—'}</span>
                        <span><i class="fas fa-envelope"></i> ${guest.email || '—'}</span>
                    </div>
                    <div>
                        ${guest.guest_type === 'vip' ? '<span class="badge" style="background: #fef3c7; color: #92400e;"><i class="fas fa-crown"></i> VIP</span>' : ''}
                        ${guest.blacklisted ? '<span class="badge" style="background: #fee2e2; color: #991b1b;"><i class="fas fa-ban"></i> Чёрный список</span>' : ''}
                        ${(guest.total_stays || 0) >= 5 ? '<span class="badge" style="background: #dbeafe; color: #1e40af;"><i class="fas fa-star"></i> Постоянный</span>' : ''}
                    </div>
                </div>
            </div>

            <div class="detail-tabs">
                <button class="detail-tab active" onclick="GuestManager.switchTab('info')">Информация</button>
                <button class="detail-tab" onclick="GuestManager.switchTab('history')">История</button>
                <button class="detail-tab" onclick="GuestManager.switchTab('notes')">Заметки</button>
            </div>

            <div id="tabInfo" class="tab-content active">
                <div class="info-grid">
                    <div class="info-card">
                        <h4>Личные данные</h4>
                        <div class="info-row"><span>Дата рождения:</span> <span>${guest.birth_date ? this.formatDate(guest.birth_date) : '—'}</span></div>
                        <div class="info-row"><span>Гражданство:</span> <span>${guest.citizenship || 'RU'}</span></div>
                        <div class="info-row"><span>Адрес:</span> <span>${guest.address || '—'}</span></div>
                    </div>
                    <div class="info-card">
                        <h4>Статистика</h4>
                        <div class="info-row"><span>Всего визитов:</span> <span>${guest.total_stays || 0}</span></div>
                        <div class="info-row"><span>Общие расходы:</span> <span>${this.formatPrice(guest.total_spent || 0)}</span></div>
                        <div class="info-row"><span>Последний визит:</span> <span>${guest.last_visit ? this.formatDate(guest.last_visit) : '—'}</span></div>
                    </div>
                </div>

                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="GuestManager.newBooking(${guest.id})">
                        <i class="fas fa-calendar-plus"></i> Новая бронь
                    </button>
                    <button class="btn btn-outline" onclick="GuestManager.edit(${guest.id})">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-outline" onclick="GuestManager.toggleBlacklist(${guest.id})" style="color: ${guest.blacklisted ? '#10b981' : '#ef4444'};">
                        <i class="fas fa-ban"></i> ${guest.blacklisted ? 'Убрать из ЧС' : 'В чёрный список'}
                    </button>
                    <button class="btn btn-outline" onclick="GuestManager.delete(${guest.id})" style="color: #ef4444;">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>

            <div id="tabHistory" class="tab-content">
                ${bookingsHistory}
            </div>

            <div id="tabNotes" class="tab-content">
                <div class="info-card">
                    <p>${guest.notes || 'Нет заметок'}</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="GuestManager.addNote(${guest.id})">
                    <i class="fas fa-plus"></i> Добавить заметку
                </button>
            </div>
        `;
    },

    switchTab(tabName) {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        event.target.classList.add('active');
        document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');
    },

    openPanel() {
        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-user-plus"></i> Новый гость';
        document.getElementById('guestForm').reset();
        document.getElementById('guestId').value = '';
        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
    },

    edit(id) {
        const guest = this.guests.find(g => g.id === id);
        if (!guest) return;

        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-edit"></i> Редактировать';
        document.getElementById('guestId').value = guest.id;
        document.getElementById('lastName').value = guest.last_name || '';
        document.getElementById('firstName').value = guest.first_name || '';
        document.getElementById('middleName').value = guest.middle_name || '';
        document.getElementById('phone').value = guest.phone || '';
        document.getElementById('email').value = guest.email || '';
        document.getElementById('birthDate').value = guest.birth_date?.split('T')[0] || '';
        document.getElementById('guestType').value = guest.guest_type || 'regular';
        document.getElementById('notes').value = guest.notes || '';
        document.getElementById('blacklisted').checked = guest.blacklisted || false;

        document.getElementById('slideOverlay').classList.add('active');
        document.getElementById('slidePanel').classList.add('active');
    },

    closePanel() {
        document.getElementById('slideOverlay').classList.remove('active');
        document.getElementById('slidePanel').classList.remove('active');
    },

    async save() {
        const id = document.getElementById('guestId').value;
        const data = {
            last_name: document.getElementById('lastName').value.trim(),
            first_name: document.getElementById('firstName').value.trim(),
            middle_name: document.getElementById('middleName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            birth_date: document.getElementById('birthDate').value || null,
            guest_type: document.getElementById('guestType').value,
            notes: document.getElementById('notes').value.trim(),
            blacklisted: document.getElementById('blacklisted').checked
        };

        if (!data.last_name || !data.first_name || !data.phone || !data.email) {
            alert('Заполните обязательные поля');
            return;
        }

        try {
            if (id) {
                await API.put(`/guests/${id}`, data);
                alert('✅ Гость обновлен');
            } else {
                await API.post('/guests/', data);
                alert('✅ Гость добавлен');
            }
            this.closePanel();
            await this.load();
            if (id) this.select(parseInt(id));
        } catch (e) {
            alert('❌ Ошибка сохранения');
        }
    },

    async toggleBlacklist(id) {
        const guest = this.guests.find(g => g.id === id);
        if (!guest) return;

        try {
            await API.put(`/guests/${id}`, { blacklisted: !guest.blacklisted });
            guest.blacklisted = !guest.blacklisted;
            this.updateStats();
            this.renderList();
            this.select(id);
        } catch (e) {
            alert('❌ Ошибка');
        }
    },

    async delete(id) {
        if (!confirm('Удалить гостя?')) return;
        try {
            await API.delete(`/guests/${id}`);
            alert('✅ Гость удален');
            this.selectedGuest = null;
            await this.load();
            document.getElementById('guestDetailContent').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-circle"></i>
                    <p>Выберите гостя из списка</p>
                </div>
            `;
        } catch (e) {
            alert('❌ Ошибка удаления');
        }
    },

    newBooking(id) {
        window.location.href = `/admin/bookings?guest_id=${id}`;
    },

    addNote(id) {
        const note = prompt('Добавить заметку:');
        if (note) {
            const guest = this.guests.find(g => g.id === id);
            if (guest) {
                guest.notes = guest.notes ? guest.notes + '\n' + note : note;
                API.put(`/guests/${id}`, { notes: guest.notes });
                this.select(id);
            }
        }
    },

    getStatusText(status) {
        const texts = {
            'pending': 'Ожидает', 'confirmed': 'Подтверждено',
            'checked_in': 'Заселен', 'checked_out': 'Выехал', 'cancelled': 'Отменено'
        };
        return texts[status] || status;
    },

    formatDate(date) {
        return date ? new Date(date).toLocaleDateString('ru-RU') : '—';
    },

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(price);
    }
};

window.GuestManager = GuestManager;