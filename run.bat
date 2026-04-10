@echo off
echo ========================================
echo    ЗАПУСК HOTEL BOSS
echo ========================================
echo.

echo [1/3] Активация виртуального окружения...
call venv\Scripts\activate

echo [2/3] Очистка кэша...
rmdir /S /Q __pycache__ 2>nul
rmdir /S /Q app\__pycache__ 2>nul

echo [3/3] Запуск сервера...
echo.
echo Сервер запущен: http://localhost:8000
echo Админка: http://localhost:8000/admin
echo Логин: admin / admin
echo.
echo Нажмите Ctrl+C для остановки
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause