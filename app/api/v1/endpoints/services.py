from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.session import get_db
from app.db.base import Service

router = APIRouter()

class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float = 0.0
    category: str = "other"
    unit: str = "услуга"
    is_active: bool = True
    is_popular: bool = False
    icon: Optional[str] = "fa-circle"

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None
    is_popular: Optional[bool] = None
    icon: Optional[str] = None

class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    category: str
    unit: str
    is_active: bool
    is_popular: bool
    icon: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    name: str
    count: int

@router.get("/", response_model=List[ServiceResponse])
async def get_services(
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_popular: Optional[bool] = None,
        search: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    """Получение списка услуг с фильтрацией"""
    query = select(Service)

    if category:
        query = query.where(Service.category == category)
    if is_active is not None:
        query = query.where(Service.is_active == is_active)
    if is_popular is not None:
        query = query.where(Service.is_popular == is_popular)
    if search:
        query = query.where(
            (Service.name.contains(search)) |
            (Service.description.contains(search))
        )

    query = query.order_by(Service.category, Service.name).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Получение списка категорий с количеством услуг"""
    result = await db.execute(select(Service))
    services = result.scalars().all()

    categories = {}
    for s in services:
        if s.category not in categories:
            categories[s.category] = 0
        categories[s.category] += 1

    return [{"name": k, "count": v} for k, v in categories.items()]

@router.post("/", response_model=ServiceResponse, status_code=201)
async def create_service(service: ServiceCreate, db: AsyncSession = Depends(get_db)):
    """Создание новой услуги"""
    db_service = Service(**service.model_dump())
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service

@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Получение информации об услуге"""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    return service

@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
        service_id: int,
        service_update: ServiceUpdate,
        db: AsyncSession = Depends(get_db)
):
    """Обновление услуги"""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    update_data = service_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)

    service.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(service)
    return service

@router.delete("/{service_id}")
async def delete_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление услуги"""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    await db.delete(service)
    await db.commit()
    return {"message": "Услуга удалена"}

@router.post("/{service_id}/toggle")
async def toggle_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Включение/выключение услуги"""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    service.is_active = not service.is_active
    await db.commit()
    return {"is_active": service.is_active}

@router.post("/{service_id}/popular")
async def toggle_popular(service_id: int, db: AsyncSession = Depends(get_db)):
    """Добавление/удаление из популярных"""
    service = await db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    service.is_popular = not service.is_popular
    await db.commit()
    return {"is_popular": service.is_popular}