const EmployeesManager = {
    employees: [],
    checklists: [],
    tasks: [],

    async init() {
        await this.loadEmployees();
        await this.loadChecklists();
        await this.loadTasks();
        this.bindEvents();
        this.setDefaultDates();
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`panel${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`).classList.add('active');
            });
        });
    },

    setDefaultDates() {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        document.getElementById('salaryStartDate').value = monthStart.toISOString().split('T')[0];
        document.getElementById('salaryEndDate').value = monthEnd.toISOString().split('T')[0];
    },

    async loadEmployees() {
        try {
            this.employees = await API.get('/employees/');
            this.renderEmployees();
            this.updateStats();
            this.updateEmployeeFilter();
        } catch (e) {}
    },

    renderEmployees() {
        const grid = document.getElementById('employeesGrid');
        grid.innerHTML = this.employees.map(e => `
            <div class="employee-card">
                <div class="employee-name">${e.full_name}</div>
                <div class="employee-position">${this.getPositionName(e.position)}</div>
                <div>📞 ${e.phone || '—'}</div>
                <div>✉️ ${e.email || '—'}</div>
                <div class="employee-salary">
                    <span>Оклад: ${this.formatPrice(e.base_salary)}</span>
                    <span>Ставка: ${this.formatPrice(e.hourly_rate)}/ч</span>
                </div>
            </div>
        `).join('');
    },

    async loadChecklists() {
        try {
            this.checklists = await API.get('/employees/checklists');
            this.renderChecklists();
        } catch (e) {}
    },

    renderChecklists() {
        const grid = document.getElementById('checklistsGrid');
        grid.innerHTML = this.checklists.map(c => `
            <div class="checklist-card">
                <h4>${c.name}</h4>
                <p style="color: #6b7280; font-size: 14px;">${this.getPositionName(c.position)}</p>
                <div class="checklist-items">
                    ${c.items.map(i => `
                        <div class="checklist-item">
                            <span>${i.name}</span>
                            <span style="color: #6366f1;">${i.points} балл. / ${i.unit}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    async loadTasks() {
        try {
            this.tasks = await API.get('/employees/tasks');
            this.renderTasks();
        } catch (e) {}
    },

    renderTasks() {
        const container = document.getElementById('tasksList');
        container.innerHTML = this.tasks.map(t => `
            <div class="task-item">
                <div>
                    <strong>${t.employee_name}</strong> — ${t.checklist_name}
                    ${t.room_number ? ` (Номер ${t.room_number})` : ''}
                    <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                        ${this.formatDate(t.task_date)} • ${t.total_points} баллов • ${this.formatPrice(t.total_amount)}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="task-status status-${t.status}">${this.getStatusName(t.status)}</span>
                    ${t.status === 'completed' ?
                        `<button class="btn btn-success btn-sm" onclick="EmployeesManager.approveTask(${t.id})">Утвердить</button>` : ''}
                </div>
            </div>
        `).join('');
    },

    async approveTask(id) {
        await API.post(`/employees/tasks/${id}/approve`);
        await this.loadTasks();
        Toast.success('Задание утверждено');
    },

    async calculateSalary() {
        const start = document.getElementById('salaryStartDate').value;
        const end = document.getElementById('salaryEndDate').value;

        const report = await API.get(`/employees/salary-report?start_date=${start}&end_date=${end}`);

        const container = document.getElementById('salaryReport');
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Сотрудник</th>
                        <th>Должность</th>
                        <th>Оклад</th>
                        <th>Заданий</th>
                        <th>Баллы</th>
                        <th>Сдельно</th>
                        <th>Итого</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.map(r => `
                        <tr>
                            <td>${r.employee_name}</td>
                            <td>${this.getPositionName(r.position)}</td>
                            <td>${this.formatPrice(r.base_salary)}</td>
                            <td>${r.tasks_completed}</td>
                            <td>${r.total_points}</td>
                            <td>${this.formatPrice(r.task_amount)}</td>
                            <td><strong>${this.formatPrice(r.total_salary)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openEmployeeModal() { UI.openModal('employeeModal'); },
    openChecklistModal() { Toast.info('Создание чек-листа'); },
    openTaskModal() { Toast.info('Назначение задания'); },

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
        Toast.success('Сотрудник добавлен');
    },

    updateStats() {
        document.getElementById('totalEmployees').textContent = this.employees.length;
        document.getElementById('maidsCount').textContent = this.employees.filter(e => e.position === 'maid').length;
        document.getElementById('pendingTasks').textContent = this.tasks.filter(t => t.status === 'completed').length;
    },

    updateEmployeeFilter() {
        const select = document.getElementById('taskEmployeeFilter');
        select.innerHTML = '<option value="">Все сотрудники</option>';
        this.employees.forEach(e => {
            select.innerHTML += `<option value="${e.id}">${e.full_name}</option>`;
        });
    },

    getPositionName(pos) {
        const names = { maid: 'Горничная', receptionist: 'Администратор', manager: 'Управляющий', technician: 'Техник', cook: 'Повар' };
        return names[pos] || pos;
    },

    getStatusName(status) {
        const names = { pending: 'Ожидает', completed: 'Выполнено', approved: 'Утверждено' };
        return names[status] || status;
    },

    formatDate(date) { return new Date(date).toLocaleDateString('ru-RU'); },
    formatPrice(p) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(p); }
};

window.EmployeesManager = EmployeesManager;