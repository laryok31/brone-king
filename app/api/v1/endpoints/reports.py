from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from typing import Optional

from app.db.session import get_db
from app.db.base import Booking, Room, Guest

router = APIRouter(prefix="/reports", tags=["Отчеты"])

@router.get("/summary")
async def get_summary(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    """Получение сводки за период"""

    # Базовые запросы
    bookings_query = select(Booking)
    rooms_query = select(Room)
    guests_query = select(Guest)

    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        bookings_query = bookings_query.where(Booking.created_at >= start)
    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        bookings_query = bookings_query.where(Booking.created_at <= end)

    bookings = (await db.execute(bookings_query)).scalars().all()
    rooms = (await db.execute(rooms_query)).scalars().all()
    guests = (await db.execute(guests_query)).scalars().all()

    total_revenue = sum(b.total_amount or 0 for b in bookings)
    total_bookings = len(bookings)
    total_guests = len(set(b.guest_id for b in bookings))
    occupancy_rate = (sum(1 for r in rooms if r.status == 'occupied') / len(rooms) * 100) if rooms else 0

    return {
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "total_guests": total_guests,
        "occupancy_rate": round(occupancy_rate, 1),
        "avg_check": total_revenue / total_bookings if total_bookings > 0 else 0
    }