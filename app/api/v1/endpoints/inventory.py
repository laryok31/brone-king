from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import random
import string

from app.db.session import get_db
from app.db.base import InventoryItem, InventoryCategory, InventoryMovement

router = APIRouter(prefix="/inventory", tags=["📦 Склад"])

# Схемы
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: str = "fa-box"
    color: str = "#6366f1"

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    icon: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True

class ItemCreate(BaseModel):
    category_id: int
    name: str
    unit: str = "шт"
    current_stock: float = 0
    minimum_stock: float = 10
    maximum_stock: float = 100
    purchase_price: float = 0
    selling_price: float = 0
    supplier: Optional[str] = ""
    location: Optional[str] = ""

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    unit: Optional[str] = None
    minimum_stock: Optional[float] = None
    maximum_stock: Optional[float] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None

class ItemResponse(BaseModel):
    id: int
    category_id: int
    name: str
    sku: Optional[str]
    unit: str
    current_stock: float
    minimum_stock: float
    maximum_stock: float
    purchase_price: float
    selling_price: float
    supplier: Optional[str]
    location: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class MovementCreate(BaseModel):
    item_id: int
    movement_type: str  # in, out, adjustment, waste
    quantity: float
    unit_price: Optional[float] = 0
    reference_type: Optional[str] = ""
    notes: Optional[str] = ""

class MovementResponse(BaseModel):
    id: int
    item_id: int
    movement_type: str
    quantity: float
    unit_price: float
    total_amount: float
    reference_type: Optional[str]
    notes: Optional[str]
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True

class StockSummaryResponse(BaseModel):
    total_items: int
    total_value: float
    low_stock_count: int
    total_purchases: float
    total_sales: float

# Категории
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryCategory).order_by(InventoryCategory.name))
    return result.scalars().all()

@router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    db_category = InventoryCategory(**category.model_dump())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

@router.delete("/categories/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    category = await db.get(InventoryCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    await db.delete(category)
    await db.commit()
    return {"message": "Категория удалена"}

# Товары
@router.get("/items", response_model=List[ItemResponse])
async def get_items(
        category_id: Optional[int] = None,
        search: Optional[str] = None,
        low_stock: bool = False,
        is_active: bool = True,
        db: AsyncSession = Depends(get_db)
):
    query = select(InventoryItem)

    if category_id:
        query = query.where(InventoryItem.category_id == category_id)
    if is_active:
        query = query.where(InventoryItem.is_active == True)
    if low_stock:
        query = query.where(InventoryItem.current_stock <= InventoryItem.minimum_stock)
    if search:
        query = query.where(
            (InventoryItem.name.contains(search)) |
            (InventoryItem.sku.contains(search))
        )

    query = query.order_by(InventoryItem.name)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_db)):
    # Генерируем SKU
    sku = f"SKU-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"

    db_item = InventoryItem(**item.model_dump(), sku=sku)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return item

@router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item_update: ItemUpdate, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")

    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/items/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    await db.delete(item)
    await db.commit()
    return {"message": "Товар удален"}

# Движения
@router.get("/movements", response_model=List[MovementResponse])
async def get_movements(
        item_id: Optional[int] = None,
        movement_type: Optional[str] = None,
        limit: int = 50,
        db: AsyncSession = Depends(get_db)
):
    query = select(InventoryMovement).order_by(InventoryMovement.created_at.desc())

    if item_id:
        query = query.where(InventoryMovement.item_id == item_id)
    if movement_type:
        query = query.where(InventoryMovement.movement_type == movement_type)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/movements", response_model=MovementResponse)
async def create_movement(movement: MovementCreate, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, movement.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")

    # Обновляем остаток
    if movement.movement_type == "in":
        item.current_stock += movement.quantity
    elif movement.movement_type in ["out", "waste"]:
        if item.current_stock < movement.quantity:
            raise HTTPException(status_code=400, detail="Недостаточно товара на складе")
        item.current_stock -= movement.quantity
    elif movement.movement_type == "adjustment":
        item.current_stock = movement.quantity

    # Создаём движение
    unit_price = movement.unit_price or (item.purchase_price if movement.movement_type == "in" else item.selling_price)
    total_amount = movement.quantity * unit_price

    db_movement = InventoryMovement(
        item_id=movement.item_id,
        movement_type=movement.movement_type,
        quantity=movement.quantity,
        unit_price=unit_price,
        total_amount=total_amount,
        reference_type=movement.reference_type,
        notes=movement.notes,
        created_by="admin"
    )

    db.add(db_movement)
    await db.commit()
    await db.refresh(db_movement)
    return db_movement

@router.get("/summary", response_model=StockSummaryResponse)
async def get_summary(db: AsyncSession = Depends(get_db)):
    items = (await db.execute(select(InventoryItem))).scalars().all()

    total_items = len(items)
    total_value = sum(i.current_stock * i.purchase_price for i in items)
    low_stock_count = sum(1 for i in items if i.current_stock <= i.minimum_stock)

    # Сумма закупок и продаж
    movements = (await db.execute(select(InventoryMovement))).scalars().all()
    total_purchases = sum(m.total_amount for m in movements if m.movement_type == "in")
    total_sales = sum(m.total_amount for m in movements if m.movement_type == "out")

    return StockSummaryResponse(
        total_items=total_items,
        total_value=total_value,
        low_stock_count=low_stock_count,
        total_purchases=total_purchases,
        total_sales=total_sales
    )