const SettingsManager = {
    settings: {},
    hasChanges: false,

    init() {
        this.loadSettings();
        this.bindEvents();
        this.setupTabs();
        this.loadProfile();
    },

    setupTabs() {
        document.querySelectorAll('.settings-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Убираем active со всех
                document.querySelectorAll('.settings-tabs .tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.settings-panels .panel').forEach(p => p.classList.remove('active'));

                // Активируем выбранную
                tab.classList.add('active');
                document.getElementById(`panel${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.add('active');

                localStorage.setItem('activeSettingsTab', tabName);
            });
        });

        // Восстанавливаем последнюю вкладку
        const lastTab = localStorage.getItem('activeSettingsTab');
        if (lastTab) {
            document.querySelector(`.settings-tabs .tab[data-tab="${lastTab}"]`)?.click();
        }
    },

    bindEvents() {
        document.querySelectorAll('.settings-panel input, .settings-panel select').forEach(el => {
            el.addEventListener('change', () => this.markAsChanged());
        });

        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.applyTheme(opt.dataset.theme);
                this.markAsChanged();
            });
        });
    },

    loadSettings() {
        const saved = localStorage.getItem('hotelSettings');
        this.settings = saved ? JSON.parse(saved) : {};
        this.applySettings();
    },

    applySettings() {
        Object.keys(this.settings).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = this.settings[key] === true || this.settings[key] === 'true';
                } else {
                    el.value = this.settings[key];
                }
            }
        });
    },

    applyTheme(theme) {
        const themes = {
            default: { primary: '#6366f1', secondary: '#8b5cf6' },
            blue: { primary: '#3b82f6', secondary: '#06b6d4' },
            green: { primary: '#10b981', secondary: '#34d399' },
            gold: { primary: '#f59e0b', secondary: '#fbbf24' },
            dark: { primary: '#1f2937', secondary: '#4b5563' }
        };

        const colors = themes[theme] || themes.default;
        document.documentElement.style.setProperty('--primary', colors.primary);
        localStorage.setItem('theme', theme);
        Toast.success(`Тема "${theme}" применена`);
    },

    markAsChanged() {
        if (!this.hasChanges) {
            this.hasChanges = true;
            document.getElementById('saveStatus').innerHTML =
                '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Есть несохраненные изменения';
        }
    },

    saveAll() {
        document.querySelectorAll('.settings-panel [id]').forEach(el => {
            if (el.type === 'checkbox') {
                this.settings[el.id] = el.checked;
            } else if (el.value !== undefined) {
                this.settings[el.id] = el.value;
            }
        });

        localStorage.setItem('hotelSettings', JSON.stringify(this.settings));

        this.hasChanges = false;
        document.getElementById('saveStatus').innerHTML =
            '<i class="fas fa-check-circle"></i> Все изменения сохранены';
        Toast.success('Настройки сохранены');
    },

    resetAll() {
        if (!confirm('Сбросить все настройки?')) return;
        localStorage.removeItem('hotelSettings');
        this.settings = {};
        location.reload();
    },

    loadProfile() {
        const user = Utils.getCurrentUser();
        if (user) {
            document.getElementById('profileName').textContent = user.full_name || 'Администратор';
            document.getElementById('profileInitials').textContent =
                (user.full_name || 'AD').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
    },

    openProfileEdit() {
        UI.openModal('profileModal');
    },

    saveProfile() {
        const firstName = document.getElementById('profileFirstName').value;
        const lastName = document.getElementById('profileLastName').value;
        const fullName = `${firstName} ${lastName}`;

        document.getElementById('profileName').textContent = fullName;
        document.getElementById('profileInitials').textContent =
            `${firstName[0]}${lastName[0]}`.toUpperCase();

        UI.closeModal('profileModal');
        Toast.success('Профиль обновлен');
    },

    connectTelegram() {
        Toast.info('Откройте @BronKingBot в Telegram и отправьте /start');
    },

    createBackup() {
        Toast.success('Резервная копия создана');
    },

    restoreBackup() {
        if (confirm('Восстановить из последней копии?')) {
            Toast.success('Восстановление начато');
        }
    },

    exportData() {
        Toast.info('Экспорт данных...');
    }
};

window.SettingsManager = SettingsManager;