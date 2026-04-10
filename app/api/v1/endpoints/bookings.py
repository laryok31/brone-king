from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import random

from app.db.session import get_db
from app.db.base import Booking, Room, Guest, BookingStatus

router = APIRouter()

class BookingCreate(BaseModel):
    room_id: int
    guest_id: int
    check_in_date: date
    check_out_date: date
    adults: int = 2
    children: int = 0
    total_amount: float
    prepayment: Optional[float] = None
    source: str = "direct"
    special_requests: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    booking_number: str
    room_id: int
    guest_id: int
    check_in_date: datetime
    check_out_date: datetime
    adults: int
    children: int
    total_amount: float
    paid_amount: float
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[BookingResponse])
async def get_bookings(
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        guest_id: Optional[int] = None,
        db: AsyncSession = Depends(get_db)
):
    query = select(Booking).order_by(Booking.created_at.desc())
    if status:
        query = query.where(Booking.status == status)
    if guest_id:
        query = query.where(Booking.guest_id == guest_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=BookingResponse, status_code=201)
async def create_booking(booking: BookingCreate, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, booking.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")

    guest = await db.get(Guest, booking.guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")

    # Проверка доступности
    existing = await db.execute(
        select(Booking).where(
            and_(
                Booking.room_id == booking.room_id,
                Booking.status.in_([BookingStatus.CONFIRMED.value, BookingStatus.CHECKED_IN.value]),
                Booking.check_in_date < booking.check_out_date,
                Booking.check_out_date > booking.check_in_date
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Номер занят на эти даты")

    booking_number = f"BK{datetime.now().strftime('%y%m%d')}{random.randint(100, 999)}"

    db_booking = Booking(
        booking_number=booking_number,
        room_id=booking.room_id,
        guest_id=booking.guest_id,
        check_in_date=booking.check_in_date,
        check_out_date=booking.check_out_date,
        adults=booking.adults,
        children=booking.children,
        total_amount=booking.total_amount,
        paid_amount=booking.prepayment or 0,
        status=BookingStatus.CONFIRMED.value if booking.prepayment else BookingStatus.PENDING.value,
        source=booking.source,
        special_requests=booking.special_requests
    )

    db.add(db_booking)

    # Обновляем статистику гостя
    guest.total_stays = (guest.total_stays or 0) + 1
    guest.total_spent = (guest.total_spent or 0) + booking.total_amount

    await db.commit()
    await db.refresh(db_booking)
    return db_booking

@router.post("/{booking_id}/check-in")
async def check_in_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")

    booking.status = "checked_in"

    room = await db.get(Room, booking.room_id)
    if room:
        room.status = "occupied"

    # АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ДОХОДА В ФИНАНСАХ
    from app.db.base import FinanceTransaction, FinanceCategory

    # Ищем категорию "Бронирования"
    cat_result = await db.execute(
        select(FinanceCategory).where(FinanceCategory.name == "Бронирования")
    )
    category = cat_result.scalar_one_or_none()

    if category and booking.total_amount:
        # Создаём доход на сумму бронирования
        transaction = FinanceTransaction(
            category_id=category.id,
            type="income",
            amount=booking.total_amount,
            description=f"Заезд: Бронь #{booking.booking_number}",
            reference_type="booking",
            reference_id=booking.id,
            payment_method="card",
            transaction_date=func.now()
        )
        db.add(transaction)

    await db.commit()
    return {"message": "Гость заселен", "booking_number": booking.booking_number}

@router.post("/{booking_id}/check-out")
async def check_out(booking_id: int, db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")

    booking.status = BookingStatus.CHECKED_OUT.value

    room = await db.get(Room, booking.room_id)
    if room:
        room.status = "cleaning"

    await db.commit()
    return {"message": "Гость выселен"}

@router.delete("/{booking_id}")
async def cancel_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")

    booking.status = BookingStatus.CANCELLED.value
    await db.commit()
    return {"message": "Бронирование отменено"}

@router.get("/available-rooms")
async def get_available_rooms(
        check_in: str,
        check_out: str,
        db: AsyncSession = Depends(get_db)
):
    """Получение свободных номеров на даты"""
    from datetime import datetime
    from app.db.base import Room

    check_in_date = datetime.strptime(check_in, "%Y-%m-%d").date()
    check_out_date = datetime.strptime(check_out, "%Y-%m-%d").date()

    # Находим занятые номера
    booked = await db.execute(
        select(Booking.room_id).where(
            and_(
                Booking.status.in_(["confirmed", "checked_in"]),
                Booking.check_in_date < check_out_date,
                Booking.check_out_date > check_in_date
            )
        )
    )
    booked_rooms = booked.scalars().all()

    # Находим свободные номера
    query = select(Room)
    if booked_rooms:
        query = query.where(~Room.id.in_(booked_rooms))

    result = await db.execute(query)
    rooms = result.scalars().all()

    return [
        {
            "id": r.id,
            "room_number": r.room_number,
            "room_type": r.room_type,
            "price_per_night": r.price_per_night,
            "capacity": r.capacity
        }
        for r in rooms
    ]