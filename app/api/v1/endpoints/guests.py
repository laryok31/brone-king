from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.db.session import get_db
from app.db.base import Guest

router = APIRouter()

class GuestCreate(BaseModel):
    first_name: str
    last_name: str
    middle_name: Optional[str] = ""
    email: EmailStr
    phone: str
    birth_date: Optional[str] = None
    citizenship: str = "RU"
    address: Optional[str] = ""
    guest_type: str = "regular"
    passport_series: Optional[str] = ""
    passport_number: Optional[str] = ""
    notes: Optional[str] = ""
    blacklisted: bool = False

class GuestUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    citizenship: Optional[str] = None
    address: Optional[str] = None
    guest_type: Optional[str] = None
    passport_series: Optional[str] = None
    passport_number: Optional[str] = None
    notes: Optional[str] = None
    blacklisted: Optional[bool] = None

class GuestResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    middle_name: Optional[str]
    email: str
    phone: str
    guest_type: str
    total_stays: int
    total_spent: float
    blacklisted: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[GuestResponse])
async def get_guests(
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        guest_type: Optional[str] = None,
        sort: str = "created_at_desc",
        db: AsyncSession = Depends(get_db)
):
    query = select(Guest)

    if guest_type:
        query = query.where(Guest.guest_type == guest_type)

    if search:
        query = query.where(
            (Guest.first_name.contains(search)) |
            (Guest.last_name.contains(search)) |
            (Guest.phone.contains(search)) |
            (Guest.email.contains(search))
        )

    # Сортировка
    if sort == "name_asc":
        query = query.order_by(Guest.last_name.asc(), Guest.first_name.asc())
    elif sort == "name_desc":
        query = query.order_by(Guest.last_name.desc(), Guest.first_name.desc())
    elif sort == "stays_desc":
        query = query.order_by(Guest.total_stays.desc())
    else:
        query = query.order_by(Guest.created_at.desc())

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=GuestResponse, status_code=201)
async def create_guest(guest: GuestCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Guest).where(
            (Guest.email == guest.email) | (Guest.phone == guest.phone)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Гость с таким email или телефоном уже существует")

    guest_data = guest.model_dump()
    if guest_data.get("birth_date"):
        guest_data["birth_date"] = datetime.fromisoformat(guest_data["birth_date"].replace('Z', '+00:00'))

    db_guest = Guest(**guest_data)
    db.add(db_guest)
    await db.commit()
    await db.refresh(db_guest)
    return db_guest

@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    guest = await db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")
    return guest

@router.put("/{guest_id}", response_model=GuestResponse)
async def update_guest(guest_id: int, guest_update: GuestUpdate, db: AsyncSession = Depends(get_db)):
    guest = await db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")

    update_data = guest_update.model_dump(exclude_unset=True)
    if update_data.get("birth_date"):
        update_data["birth_date"] = datetime.fromisoformat(update_data["birth_date"].replace('Z', '+00:00'))

    for field, value in update_data.items():
        setattr(guest, field, value)

    await db.commit()
    await db.refresh(guest)
    return guest

@router.delete("/{guest_id}")
async def delete_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    guest = await db.get(Guest, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Гость не найден")

    await db.delete(guest)
    await db.commit()
    return {"message": "Гость удален"}