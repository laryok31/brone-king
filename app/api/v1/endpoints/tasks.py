from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from typing import List
from pydantic import BaseModel

from app.db.session import get_db
from app.db.base import Room, Booking, Employee, EmployeeTask, TaskChecklist

router = APIRouter(prefix="/tasks", tags=["✅ Задачи"])

class TaskResponse(BaseModel):
    id: int
    room_number: str
    task_type: str
    status: str
    scheduled_time: datetime
    assigned_to: str

@router.get("/pending", response_model=List[TaskResponse])
async def get_pending_tasks(db: AsyncSession = Depends(get_db)):
    """Получение списка ожидающих задач"""
    # Находим номера, требующие уборки
    rooms = (await db.execute(
        select(Room).where(Room.status == "cleaning")
    )).scalars().all()

    tasks = []
    for room in rooms:
        # Находим последний выезд из этого номера
        booking = (await db.execute(
            select(Booking).where(
                and_(
                    Booking.room_id == room.id,
                    Booking.status == "checked_out"
                )
            ).order_by(Booking.check_out_date.desc())
        )).scalars().first()

        tasks.append(TaskResponse(
            id=room.id,
            room_number=room.room_number,
            task_type="cleaning",
            status="pending",
            scheduled_time=booking.check_out_date if booking else datetime.now(),
            assigned_to="Не назначен"
        ))

    return tasks

@router.post("/auto-check")
async def auto_check_tasks(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Автоматическая проверка и создание задач"""

    # Проверяем выезды сегодня
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)

    checkouts = (await db.execute(
        select(Booking).where(
            and_(
                Booking.status == "checked_out",
                Booking.check_out_date >= today,
                Booking.check_out_date < tomorrow
            )
        )
    )).scalars().all()

    # Автоматически ставим статус "уборка" для номеров после выезда
    for booking in checkouts:
        room = await db.get(Room, booking.room_id)
        if room and room.status == "occupied":
            room.status = "cleaning"

    await db.commit()

    return {
        "checkouts_today": len(checkouts),
        "rooms_marked_cleaning": len(checkouts)
    }

@router.get("/suggestions")
async def get_suggestions(db: AsyncSession = Depends(get_db)):
    """Умные подсказки для администратора"""
    suggestions = []

    # Проверяем номера на уборку
    cleaning_rooms = (await db.execute(
        select(Room).where(Room.status == "cleaning")
    )).scalars().all()

    if cleaning_rooms:
        suggestions.append({
            "type": "warning",
            "title": "Требуется уборка",
            "message": f"{len(cleaning_rooms)} номеров ожидают уборки. Номера: {', '.join(r.room_number for r in cleaning_rooms[:3])}",
            "action": "/admin/rooms"
        })

    # Проверяем заезды сегодня
    today = datetime.now().date()
    checkins = (await db.execute(
        select(Booking).where(
            and_(
                Booking.status == "confirmed",
                Booking.check_in_date >= today,
                Booking.check_in_date < today + timedelta(days=1)
            )
        )
    )).scalars().all()

    if checkins:
        suggestions.append({
            "type": "info",
            "title": "Заезды сегодня",
            "message": f"Ожидается {len(checkins)} заездов. Подготовьте номера.",
            "action": "/admin/bookings"
        })

    # Проверяем низкие остатки на складе
    from app.db.base import InventoryItem
    low_stock = (await db.execute(
        select(InventoryItem).where(InventoryItem.current_stock <= InventoryItem.minimum_stock)
    )).scalars().all()

    if low_stock:
        suggestions.append({
            "type": "warning",
            "title": "Заканчиваются товары",
            "message": f"{len(low_stock)} позиций требуют пополнения.",
            "action": "/admin/inventory"
        })

    return suggestions