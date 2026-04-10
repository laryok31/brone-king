from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.db.session import get_db
from app.db.base import Room, Booking, RoomStatus

router = APIRouter()

class RoomBase(BaseModel):
    room_number: str
    floor: int
    room_type: str
    capacity: int = 2
    price_per_night: float
    weekend_price: Optional[float] = None
    description: Optional[str] = None
    amenities: List[str] = []
    status: str = "available"
    square_meters: Optional[float] = None
    has_balcony: bool = False

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[int] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    price_per_night: Optional[float] = None
    weekend_price: Optional[float] = None
    description: Optional[str] = None
    amenities: Optional[List[str]] = None
    status: Optional[str] = None
    square_meters: Optional[float] = None
    has_balcony: Optional[bool] = None

class RoomResponse(RoomBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[RoomResponse])
async def get_rooms(
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        room_type: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    query = select(Room)
    if status:
        query = query.where(Room.status == status)
    if room_type:
        query = query.where(Room.room_type == room_type)
    query = query.offset(skip).limit(limit).order_by(Room.room_number)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=RoomResponse, status_code=201)
async def create_room(room: RoomCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Room).where(Room.room_number == room.room_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Номер с таким номером уже существует")

    db_room = Room(**room.model_dump())
    db.add(db_room)
    await db.commit()
    await db.refresh(db_room)
    return db_room

@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(room_id: int, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")
    return room

@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(room_id: int, room_update: RoomUpdate, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")

    update_data = room_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(room, field, value)

    await db.commit()
    await db.refresh(room)
    return room

@router.delete("/{room_id}")
async def delete_room(room_id: int, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Номер не найден")

    await db.delete(room)
    await db.commit()
    return {"message": "Номер удален"}

# Найти эндпоинт available-rooms и исправить метод
@router.get("/available-rooms")
async def get_available_rooms(
        check_in: str,
        check_out: str,
        db: AsyncSession = Depends(get_db)
):
    """Получение свободных номеров на даты"""
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