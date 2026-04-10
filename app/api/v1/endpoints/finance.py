from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.db.session import get_db
from app.db.base import FinanceCategory, FinanceTransaction, Salary, InventoryMovement, Booking

router = APIRouter(prefix="/finance", tags=["💰 Финансы"])

# Схемы
class CategoryCreate(BaseModel):
    name: str
    type: str  # income, expense
    icon: str = "fa-circle"
    color: str = "#6366f1"

class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    icon: str
    color: str

    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    category_id: int
    type: str
    amount: float
    description: Optional[str] = ""
    reference_type: Optional[str] = ""
    reference_id: Optional[int] = None
    payment_method: str = "cash"
    transaction_date: Optional[datetime] = None

class TransactionResponse(BaseModel):
    id: int
    category_id: int
    type: str
    amount: float
    description: Optional[str]
    reference_type: Optional[str]
    payment_method: str
    status: str
    transaction_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class SalaryCreate(BaseModel):
    employee_name: str
    position: Optional[str] = ""
    amount: float
    bonus: float = 0
    deductions: float = 0
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    notes: Optional[str] = ""

class SalaryResponse(BaseModel):
    id: int
    employee_name: str
    position: Optional[str]
    amount: float
    bonus: float
    deductions: float
    total: float
    payment_date: datetime
    status: str

    class Config:
        from_attributes = True

class FinanceSummaryResponse(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    bookings_revenue: float
    inventory_sales: float
    inventory_purchases: float
    salaries_total: float

# Категории
@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
        type: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    query = select(FinanceCategory).order_by(FinanceCategory.name)
    if type:
        query = query.where(FinanceCategory.type == type)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    db_category = FinanceCategory(**category.model_dump())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

# Транзакции
@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
        type: Optional[str] = None,
        category_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50,
        db: AsyncSession = Depends(get_db)
):
    query = select(FinanceTransaction).order_by(FinanceTransaction.transaction_date.desc())

    if type:
        query = query.where(FinanceTransaction.type == type)
    if category_id:
        query = query.where(FinanceTransaction.category_id == category_id)
    if start_date:
        query = query.where(FinanceTransaction.transaction_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(FinanceTransaction.transaction_date <= datetime.fromisoformat(end_date))

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, db: AsyncSession = Depends(get_db)):
    if not transaction.transaction_date:
        transaction.transaction_date = datetime.utcnow()

    db_transaction = FinanceTransaction(**transaction.model_dump())
    db.add(db_transaction)
    await db.commit()
    await db.refresh(db_transaction)
    return db_transaction

@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, db: AsyncSession = Depends(get_db)):
    transaction = await db.get(FinanceTransaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Транзакция не найдена")
    await db.delete(transaction)
    await db.commit()
    return {"message": "Транзакция удалена"}

# Зарплаты
@router.get("/salaries", response_model=List[SalaryResponse])
async def get_salaries(
        limit: int = 50,
        db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Salary).order_by(Salary.payment_date.desc()).limit(limit)
    )
    return result.scalars().all()

@router.post("/salaries", response_model=SalaryResponse)
async def create_salary(salary: SalaryCreate, db: AsyncSession = Depends(get_db)):
    total = salary.amount + salary.bonus - salary.deductions

    db_salary = Salary(
        **salary.model_dump(),
        total=total,
        payment_date=datetime.utcnow(),
        status="paid"
    )
    db.add(db_salary)

    # Автоматически создаём транзакцию расхода
    salary_category = await db.execute(
        select(FinanceCategory).where(FinanceCategory.name == "Зарплата")
    )
    category = salary_category.scalar_one_or_none()

    if category:
        transaction = FinanceTransaction(
            category_id=category.id,
            type="expense",
            amount=total,
            description=f"Зарплата: {salary.employee_name}",
            reference_type="salary",
            payment_method="transfer"
        )
        db.add(transaction)

    await db.commit()
    await db.refresh(db_salary)
    return db_salary

@router.delete("/salaries/{salary_id}")
async def delete_salary(salary_id: int, db: AsyncSession = Depends(get_db)):
    salary = await db.get(Salary, salary_id)
    if not salary:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await db.delete(salary)
    await db.commit()
    return {"message": "Запись удалена"}

# Сводка
@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_summary(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    # Доходы и расходы из финансовых транзакций
    trans_query = select(FinanceTransaction)
    if start_date:
        trans_query = trans_query.where(FinanceTransaction.transaction_date >= datetime.fromisoformat(start_date))
    if end_date:
        trans_query = trans_query.where(FinanceTransaction.transaction_date <= datetime.fromisoformat(end_date))

    transactions = (await db.execute(trans_query)).scalars().all()

    total_income = sum(t.amount for t in transactions if t.type == "income")
    total_expense = sum(t.amount for t in transactions if t.type == "expense")

    # Доходы от бронирований
    bookings_query = select(Booking).where(Booking.status.in_(["confirmed", "checked_in", "checked_out"]))
    if start_date:
        bookings_query = bookings_query.where(Booking.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        bookings_query = bookings_query.where(Booking.created_at <= datetime.fromisoformat(end_date))

    bookings = (await db.execute(bookings_query)).scalars().all()
    bookings_revenue = sum(b.total_amount or 0 for b in bookings)

    # Складские движения
    inv_query = select(InventoryMovement)
    if start_date:
        inv_query = inv_query.where(InventoryMovement.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        inv_query = inv_query.where(InventoryMovement.created_at <= datetime.fromisoformat(end_date))

    movements = (await db.execute(inv_query)).scalars().all()
    inventory_sales = sum(m.total_amount for m in movements if m.movement_type == "out")
    inventory_purchases = sum(m.total_amount for m in movements if m.movement_type == "in")

    # Зарплаты
    sal_query = select(Salary)
    if start_date:
        sal_query = sal_query.where(Salary.payment_date >= datetime.fromisoformat(start_date))
    if end_date:
        sal_query = sal_query.where(Salary.payment_date <= datetime.fromisoformat(end_date))

    salaries = (await db.execute(sal_query)).scalars().all()
    salaries_total = sum(s.total for s in salaries)

    return FinanceSummaryResponse(
        total_income=total_income,
        total_expense=total_expense,
        balance=total_income - total_expense,
        bookings_revenue=bookings_revenue,
        inventory_sales=inventory_sales,
        inventory_purchases=inventory_purchases,
        salaries_total=salaries_total
    )

# Создать дефолтные категории
@router.post("/init-defaults")
async def init_default_categories(db: AsyncSession = Depends(get_db)):
    defaults = [
        # Доходы
        {"name": "Бронирования", "type": "income", "icon": "fa-calendar-check", "color": "#10b981"},
        {"name": "Продажи со склада", "type": "income", "icon": "fa-box", "color": "#6366f1"},
        {"name": "Услуги", "type": "income", "icon": "fa-concierge-bell", "color": "#8b5cf6"},
        {"name": "Прочие доходы", "type": "income", "icon": "fa-plus-circle", "color": "#6b7280"},
        # Расходы
        {"name": "Зарплата", "type": "expense", "icon": "fa-users", "color": "#ef4444"},
        {"name": "Закупки", "type": "expense", "icon": "fa-truck", "color": "#f59e0b"},
        {"name": "Коммунальные услуги", "type": "expense", "icon": "fa-bolt", "color": "#3b82f6"},
        {"name": "Транспорт", "type": "expense", "icon": "fa-gas-pump", "color": "#ec4899"},
        {"name": "Реклама", "type": "expense", "icon": "fa-bullhorn", "color": "#14b8a6"},
        {"name": "Ремонт и обслуживание", "type": "expense", "icon": "fa-tools", "color": "#78716c"},
        {"name": "Прочие расходы", "type": "expense", "icon": "fa-minus-circle", "color": "#6b7280"},
    ]

    for cat in defaults:
        existing = await db.execute(select(FinanceCategory).where(FinanceCategory.name == cat["name"]))
        if not existing.scalar_one_or_none():
            db.add(FinanceCategory(**cat))

    await db.commit()
    return {"message": "Категории созданы"}