from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.db.session import init_db
from app.api.v1.endpoints import auth, rooms, bookings, guests, admin, services, reports, inventory, finance, employees, tasks
from app.web import web_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Запуск Hotel BOSS...")
    await init_db()
    print("✅ База данных готова")
    yield
    print("👋 Завершение работы")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
api_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=f"{api_prefix}/auth", tags=["🔐 Авторизация"])
app.include_router(rooms.router, prefix=f"{api_prefix}/rooms", tags=["🏨 Номера"])
app.include_router(bookings.router, prefix=f"{api_prefix}/bookings", tags=["📅 Бронирования"])
app.include_router(guests.router, prefix=f"{api_prefix}/guests", tags=["👥 Гости"])
app.include_router(services.router, prefix=f"{settings.API_V1_STR}/services", tags=["🛎️ Услуги"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}", tags=["📊 Отчеты"])
app.include_router(inventory.router, prefix=f"{settings.API_V1_STR}", tags=["📦 Склад"])
app.include_router(finance.router, prefix=f"{settings.API_V1_STR}", tags=["💰 Финансы"])
app.include_router(employees.router, prefix=f"{settings.API_V1_STR}", tags=["👥 Сотрудники"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}", tags=["✅ Задачи"])
app.include_router(admin.router, prefix=api_prefix, tags=["👑 Админ-панель"])

# Web Routes
app.include_router(web_router)

# Static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}