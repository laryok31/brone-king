from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional

from app.db.session import get_db
from app.db.base import Room, Guest, Booking, InventoryItem, InventoryMovement, FinanceTransaction, FinanceCategory

router = APIRouter(prefix="/admin", tags=["👑 Админ-панель"])

class StatsResponse(BaseModel):
    total_rooms: int = 0
    occupied_rooms: int = 0
    available_rooms: int = 0
    cleaning_rooms: int = 0
    total_guests: int = 0
    vip_guests: int = 0
    today_checkins: int = 0
    today_checkouts: int = 0
    monthly_revenue: float = 0
    occupancy_rate: float = 0

@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    rooms = (await db.execute(select(Room))).scalars().all()
    guests = (await db.execute(select(Guest))).scalars().all()

    total_rooms = len(rooms)
    occupied_rooms = sum(1 for r in rooms if r.status == "occupied")
    available_rooms = sum(1 for r in rooms if r.status == "available")
    cleaning_rooms = sum(1 for r in rooms if r.status == "cleaning")

    total_guests = len(guests)
    vip_guests = sum(1 for g in guests if getattr(g, 'guest_type', 'regular') == 'vip')

    today = datetime.now().date()
    today_checkins = 0
    today_checkouts = 0
    monthly_revenue = 0.0
    occupancy_rate = (occupied_rooms / total_rooms * 100) if total_rooms > 0 else 0

    return StatsResponse(
        total_rooms=total_rooms,
        occupied_rooms=occupied_rooms,
        available_rooms=available_rooms,
        cleaning_rooms=cleaning_rooms,
        total_guests=total_guests,
        vip_guests=vip_guests,
        today_checkins=today_checkins,
        today_checkouts=today_checkouts,
        monthly_revenue=monthly_revenue,
        occupancy_rate=round(occupancy_rate, 1)
    )

@router.get("/dashboard/full")
async def get_full_dashboard(db: AsyncSession = Depends(get_db)):
    """Полная сводка для дашборда"""

    rooms = (await db.execute(select(Room))).scalars().all()
    guests = (await db.execute(select(Guest))).scalars().all()
    all_bookings = (await db.execute(select(Booking))).scalars().all()

    today = datetime.now().date()
    month_start = today.replace(day=1)

    active_bookings = [b for b in all_bookings if b.status in ["confirmed", "checked_in"]]
    today_checkins = len([b for b in all_bookings if b.check_in_date and b.check_in_date.date() == today])
    today_checkouts = len([b for b in all_bookings if b.check_out_date and b.check_out_date.date() == today])

    month_revenue = sum(b.total_amount or 0 for b in all_bookings
                        if b.created_at and b.created_at.date() >= month_start
                        and b.status in ["confirmed", "checked_in", "checked_out"])

    occupied_rooms = sum(1 for r in rooms if r.status == "occupied")
    occupancy_rate = (occupied_rooms / len(rooms) * 100) if rooms else 0

    # Склад
    try:
        inventory_items = (await db.execute(select(InventoryItem))).scalars().all()
        low_stock_items = [i for i in inventory_items if i.current_stock <= i.minimum_stock]
        inventory_value = sum(i.current_stock * i.purchase_price for i in inventory_items)
    except:
        inventory_items = []
        low_stock_items = []
        inventory_value = 0

    # Финансы
    try:
        finance_transactions = (await db.execute(
            select(FinanceTransaction).where(FinanceTransaction.transaction_date >= month_start)
        )).scalars().all()
        month_income = sum(t.amount for t in finance_transactions if t.type == "income")
        month_expense = sum(t.amount for t in finance_transactions if t.type == "expense")
    except:
        month_income = 0
        month_expense = 0

    # График выручки
    revenue_chart = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_revenue = sum(b.total_amount or 0 for b in all_bookings
                          if b.created_at and b.created_at.date() == day)
        revenue_chart.append({
            "date": day.strftime("%d.%m"),
            "revenue": day_revenue
        })

    # Популярные номера
    room_popularity = {}
    for b in all_bookings:
        if b.room_id:
            room_popularity[b.room_id] = room_popularity.get(b.room_id, 0) + 1

    popular_rooms_data = []
    for room_id, count in sorted(room_popularity.items(), key=lambda x: x[1], reverse=True)[:5]:
        room = next((r for r in rooms if r.id == room_id), None)
        if room:
            popular_rooms_data.append({
                "room_number": room.room_number,
                "bookings": count
            })

    return {
        "stats": {
            "total_rooms": len(rooms),
            "occupied_rooms": occupied_rooms,
            "total_guests": len(guests),
            "vip_guests": sum(1 for g in guests if getattr(g, 'guest_type', 'regular') == 'vip'),
            "active_bookings": len(active_bookings),
            "today_checkins": today_checkins,
            "today_checkouts": today_checkouts,
            "month_revenue": month_revenue,
            "occupancy_rate": round(occupancy_rate, 1),
            "inventory_items": len(inventory_items),
            "low_stock_count": len(low_stock_items),
            "inventory_value": inventory_value,
            "month_income": month_income,
            "month_expense": month_expense,
            "month_balance": month_income - month_expense
        },
        "revenue_chart": revenue_chart,
        "popular_rooms": popular_rooms_data,
        "recent_bookings": [
            {
                "id": b.id,
                "booking_number": b.booking_number,
                "guest_id": b.guest_id,
                "room_id": b.room_id,
                "check_in": b.check_in_date.isoformat() if b.check_in_date else None,
                "check_out": b.check_out_date.isoformat() if b.check_out_date else None,
                "total_amount": b.total_amount,
                "status": b.status
            }
            for b in sorted(all_bookings, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]
        ],
        "recent_transactions": [],
        "recent_movements": []
    }

@router.get("/recent-bookings")
async def get_recent_bookings(limit: int = 5, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking).order_by(Booking.created_at.desc()).limit(limit)
    )
    bookings = result.scalars().all()

    response = []
    for b in bookings:
        guest = await db.get(Guest, b.guest_id) if b.guest_id else None
        room = await db.get(Room, b.room_id) if b.room_id else None

        response.append({
            "id": b.id,
            "booking_number": b.booking_number,
            "guest_id": b.guest_id,
            "guest_name": f"{guest.last_name} {guest.first_name}" if guest else "Гость",
            "room_id": b.room_id,
            "room_number": room.room_number if room else "—",
            "check_in_date": b.check_in_date,
            "check_out_date": b.check_out_date,
            "total_amount": b.total_amount,
            "paid_amount": b.paid_amount,
            "status": b.status
        })

    return response