// Модуль для работы с графиками
class ChartManager {
    constructor() {
        this.charts = {};
    }

    initRevenueChart(canvasId, data = null) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        const defaultData = {
            labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
            datasets: [{
                label: 'Доход (₽)',
                data: [45000, 52000, 49000, 58000, 65000, 72000, 68000],
                borderColor: '#c5a028',
                backgroundColor: 'rgba(197, 160, 40, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#1a365d',
                pointBorderColor: '#c5a028',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        };

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: data || defaultData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a365d',
                        titleColor: '#c5a028',
                        bodyColor: '#fff',
                        borderColor: '#c5a028',
                        borderWidth: 2
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            callback: (value) => value.toLocaleString('ru-RU') + ' ₽'
                        }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    initOccupancyChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        this.charts.occupancy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Стандарт', 'Улучшенный', 'Люкс', 'Семейный', 'Президентский'],
                datasets: [{
                    label: 'Занято',
                    data: [12, 8, 5, 3, 1],
                    backgroundColor: '#1a365d',
                    borderRadius: 8
                }, {
                    label: 'Свободно',
                    data: [8, 4, 2, 1, 1],
                    backgroundColor: '#c5a028',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        backgroundColor: '#1a365d',
                        titleColor: '#c5a028'
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                }
            }
        });
    }

    updateRevenueChart(period) {
        const data = {
            week: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                data: [45000, 52000, 49000, 58000, 65000, 72000, 68000]
            },
            month: {
                labels: ['1 нед', '2 нед', '3 нед', '4 нед'],
                data: [280000, 310000, 350000, 310000]
            },
            year: {
                labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
                data: [1200000, 1150000, 1300000, 1250000, 1400000, 1580000, 1700000, 1650000, 1500000, 1450000, 1350000, 1600000]
            }
        };

        if (this.charts.revenue) {
            this.charts.revenue.data.labels = data[period].labels;
            this.charts.revenue.data.datasets[0].data = data[period].data;
            this.charts.revenue.update();
        }
    }

    updateOccupancyChart(type) {
        if (!this.charts.occupancy) return;

        if (type === 'daily') {
            this.charts.occupancy.data.labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            this.charts.occupancy.data.datasets[0].data = [18, 20, 19, 21, 22, 23, 21];
            this.charts.occupancy.data.datasets[1].data = [6, 4, 5, 3, 2, 1, 3];
        } else {
            this.charts.occupancy.data.labels = ['Стандарт', 'Улучшенный', 'Люкс', 'Семейный', 'Президентский'];
            this.charts.occupancy.data.datasets[0].data = [12, 8, 5, 3, 1];
            this.charts.occupancy.data.datasets[1].data = [8, 4, 2, 1, 1];
        }
        this.charts.occupancy.update();
    }
}

// Создаем глобальный экземпляр
window.chartManager = new ChartManager();