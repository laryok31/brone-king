const RoomsManager = {
    rooms: [],
    filterStatus: '',
    filterType: '',
    
    async init() {
        await this.load();
        this.bindEvents();
    },
    
    bindEvents() {
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.render();
        });
        
        document.getElementById('typeFilter')?.addEventListener('change', (e) => {
            this.filterType = e.target.value;
            this.render();
        });
    },
    
    async load() {
        try {
            UI.showLoading();
            this.rooms = await API.get('/rooms/');
            this.render();
            this.updateStats();
        } catch (e) {
            Toast.error('Ошибка загрузки номеров');
        } finally {
            UI.hideLoading();
        }
    },
    
    render() {
        const tbody = document.getElementById('roomsTableBody');
        let filtered = this.rooms;
        
        if (this.filterStatus) {
            filtered = filtered.filter(r => r.status === this.filterStatus);
        }
        if (this.filterType) {
            filtered = filtered.filter(r => r.room_type === this.filterType);
        }
        
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-6">Нет номеров</td></tr>';
            return;
        }
        
        const typeNames = {
            'standard': 'Стандарт', 'superior': 'Улучшенный', 
            'deluxe': 'Делюкс', 'suite': 'Люкс', 'family': 'Семейный'
        };
        
        const statusNames = {
            'available': 'Свободен', 'occupied': 'Занят',
            'cleaning': 'Уборка', 'maintenance': 'Ремонт'
        };
        
        const statusBadges = {
            'available': 'badge-success', 'occupied': 'badge-danger',
            'cleaning': 'badge-warning', 'maintenance': 'badge-secondary'
        };
        
        tbody.innerHTML = filtered.map(r => `
            <tr>
                <td><strong>${r.room_number}</strong></td>
                <td>${typeNames[r.room_type] || r.room_type}</td>
                <td>${r.floor} этаж</td>
                <td>${r.capacity} чел.</td>
                <td>${Utils.formatCurrency(r.price_per_night)}</td>
                <td><span class="badge ${statusBadges[r.status]}">${statusNames[r.status]}</span></td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn-icon" onclick="RoomsManager.edit(${r.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="RoomsManager.delete(${r.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    },
    
    updateStats() {
        document.getElementById('totalRoomsStat').textContent = this.rooms.length;
        document.getElementById('availableRoomsStat').textContent = this.rooms.filter(r => r.status === 'available').length;
        document.getElementById('occupiedRoomsStat').textContent = this.rooms.filter(r => r.status === 'occupied').length;
        document.getElementById('cleaningRoomsStat').textContent = this.rooms.filter(r => r.status === 'cleaning').length;
    },
    
    resetFilters() {
        document.getElementById('statusFilter').value = '';
        document.getElementById('typeFilter').value = '';
        this.filterStatus = '';
        this.filterType = '';
        this.render();
    },
    
    openModal() {
        document.getElementById('roomModalTitle').textContent = 'Добавить номер';
        document.getElementById('roomForm').reset();
        document.getElementById('roomId').value = '';
        UI.openModal('roomModal');
    },
    
    async edit(id) {
        const room = this.rooms.find(r => r.id === id);
        if (!room) return;
        
        document.getElementById('roomModalTitle').textContent = 'Редактировать номер';
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomNumber').value = room.room_number;
        document.getElementById('roomFloor').value = room.floor;
        document.getElementById('roomType').value = room.room_type;
        document.getElementById('roomCapacity').value = room.capacity;
        document.getElementById('roomPrice').value = room.price_per_night;
        document.getElementById('roomStatus').value = room.status;
        
        UI.openModal('roomModal');
    },
    
    async save() {
        const form = document.getElementById('roomForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        const roomData = {
            room_number: data.room_number,
            floor: parseInt(data.floor),
            room_type: data.room_type,
            capacity: parseInt(data.capacity) || 2,
            price_per_night: parseFloat(data.price_per_night),
            status: data.status || 'available'
        };
        
        try {
            UI.showLoading();
            if (data.id) {
                await API.put(`/rooms/${data.id}`, roomData);
                Toast.success('Номер обновлен');
            } else {
                await API.post('/rooms/', roomData);
                Toast.success('Номер добавлен');
            }
            UI.closeModal('roomModal');
            await this.load();
        } catch (e) {
            Toast.error('Ошибка сохранения');
        } finally {
            UI.hideLoading();
        }
    },

    async markCleaned(roomId) {
        await API.put(`/rooms/${roomId}`, { status: 'available' });

        // Автоматически начисляем зарплату горничной если включено
        const settings = JSON.parse(localStorage.getItem('financeSettings') || '{}');
        if (settings.autoSalary) {
            await API.post('/employees/tasks', {
                employee_id: null, // Нужно выбрать горничную
                checklist_id: null, // Нужен чек-лист уборки
                room_id: roomId,
                task_date: new Date().toISOString()
            });
        }

        Toast.success('Номер отмечен как убранный');
        await this.load();
    }
    
    async delete(id) {
        if (!confirm('Удалить номер?')) return;
        try {
            await API.delete(`/rooms/${id}`);
            Toast.success('Номер удален');
            await this.load();
        } catch (e) {
            Toast.error('Ошибка удаления');
        }
    }
};

window.RoomsManager = RoomsManager;