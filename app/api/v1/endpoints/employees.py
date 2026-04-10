from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.db.session import get_db
from app.db.base import Employee, TaskChecklist, ChecklistItem, EmployeeTask, TaskItemCompletion, Room

router = APIRouter(prefix="/employees", tags=["👥 Сотрудники"])

# Схемы
class EmployeeCreate(BaseModel):
    full_name: str
    position: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    base_salary: float = 0
    hourly_rate: float = 0

class EmployeeResponse(BaseModel):
    id: int
    full_name: str
    position: str
    phone: Optional[str]
    email: Optional[str]
    base_salary: float
    hourly_rate: float
    is_active: bool

    class Config:
        from_attributes = True

class ChecklistItemCreate(BaseModel):
    name: str
    points: float = 1.0
    unit: str = "шт"

class ChecklistCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    position: str
    items: List[ChecklistItemCreate]

class ChecklistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    position: str
    items: List[ChecklistItemCreate]

    class Config:
        from_attributes = True

class TaskCompletionCreate(BaseModel):
    item_id: int
    quantity: float = 1

class EmployeeTaskCreate(BaseModel):
    employee_id: int
    checklist_id: int
    room_id: Optional[int] = None
    task_date: datetime
    items: List[TaskCompletionCreate]

class EmployeeTaskResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    checklist_id: int
    checklist_name: str
    room_id: Optional[int]
    room_number: Optional[str]
    task_date: datetime
    status: str
    total_points: float
    total_amount: float
    items_completed: List[dict]

    class Config:
        from_attributes = True

class SalaryReportResponse(BaseModel):
    employee_id: int
    employee_name: str
    position: str
    base_salary: float
    tasks_completed: int
    total_points: float
    task_amount: float
    total_salary: float

# Сотрудники
@router.get("/", response_model=List[EmployeeResponse])
async def get_employees(
        position: Optional[str] = None,
        is_active: bool = True,
        db: AsyncSession = Depends(get_db)
):
    query = select(Employee).order_by(Employee.full_name)
    if position:
        query = query.where(Employee.position == position)
    if is_active:
        query = query.where(Employee.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=EmployeeResponse)
async def create_employee(employee: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    db_employee = Employee(**employee.model_dump())
    db.add(db_employee)
    await db.commit()
    await db.refresh(db_employee)
    return db_employee

@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(employee_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    employee = await db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    for key, value in data.items():
        if hasattr(employee, key):
            setattr(employee, key, value)

    await db.commit()
    await db.refresh(employee)
    return employee

# Чек-листы
@router.get("/checklists", response_model=List[ChecklistResponse])
async def get_checklists(
        position: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    query = select(TaskChecklist).order_by(TaskChecklist.name)
    if position:
        query = query.where(TaskChecklist.position == position)
    result = await db.execute(query)
    checklists = result.scalars().all()

    response = []
    for cl in checklists:
        items_result = await db.execute(
            select(ChecklistItem).where(ChecklistItem.checklist_id == cl.id).order_by(ChecklistItem.order_num)
        )
        items = items_result.scalars().all()
        response.append(ChecklistResponse(
            id=cl.id,
            name=cl.name,
            description=cl.description,
            position=cl.position,
            items=[ChecklistItemCreate(name=i.name, points=i.points, unit=i.unit) for i in items]
        ))

    return response

@router.post("/checklists", response_model=ChecklistResponse)
async def create_checklist(data: ChecklistCreate, db: AsyncSession = Depends(get_db)):
    checklist = TaskChecklist(
        name=data.name,
        description=data.description,
        position=data.position
    )
    db.add(checklist)
    await db.flush()

    for idx, item in enumerate(data.items):
        db_item = ChecklistItem(
            checklist_id=checklist.id,
            name=item.name,
            points=item.points,
            unit=item.unit,
            order_num=idx
        )
        db.add(db_item)

    await db.commit()
    await db.refresh(checklist)

    return ChecklistResponse(
        id=checklist.id,
        name=checklist.name,
        description=checklist.description,
        position=checklist.position,
        items=data.items
    )

# Задания сотрудников
@router.get("/tasks", response_model=List[EmployeeTaskResponse])
async def get_tasks(
        employee_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    query = select(EmployeeTask).order_by(EmployeeTask.task_date.desc())

    if employee_id:
        query = query.where(EmployeeTask.employee_id == employee_id)
    if status:
        query = query.where(EmployeeTask.status == status)
    if start_date:
        query = query.where(EmployeeTask.task_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(EmployeeTask.task_date <= datetime.fromisoformat(end_date))

    result = await db.execute(query)
    tasks = result.scalars().all()

    response = []
    for task in tasks:
        employee = await db.get(Employee, task.employee_id)
        checklist = await db.get(TaskChecklist, task.checklist_id)
        room = await db.get(Room, task.room_id) if task.room_id else None

        completions = await db.execute(
            select(TaskItemCompletion).where(TaskItemCompletion.task_id == task.id)
        )
        items = []
        for c in completions.scalars().all():
            item = await db.get(ChecklistItem, c.item_id)
            items.append({
                "item_name": item.name if item else "—",
                "quantity": c.quantity,
                "points": c.points_earned
            })

        response.append(EmployeeTaskResponse(
            id=task.id,
            employee_id=task.employee_id,
            employee_name=employee.full_name if employee else "—",
            checklist_id=task.checklist_id,
            checklist_name=checklist.name if checklist else "—",
            room_id=task.room_id,
            room_number=room.room_number if room else None,
            task_date=task.task_date,
            status=task.status,
            total_points=task.total_points,
            total_amount=task.total_amount,
            items_completed=items
        ))

    return response

@router.post("/tasks", response_model=EmployeeTaskResponse)
async def create_task(data: EmployeeTaskCreate, db: AsyncSession = Depends(get_db)):
    employee = await db.get(Employee, data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    checklist = await db.get(TaskChecklist, data.checklist_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Чек-лист не найден")

    # Считаем баллы
    total_points = 0
    for item_data in data.items:
        item = await db.get(ChecklistItem, item_data.item_id)
        if item:
            total_points += item.points * item_data.quantity

    total_amount = total_points * (employee.hourly_rate or employee.base_salary / 160)

    task = EmployeeTask(
        employee_id=data.employee_id,
        checklist_id=data.checklist_id,
        room_id=data.room_id,
        task_date=data.task_date,
        total_points=total_points,
        total_amount=total_amount
    )
    db.add(task)
    await db.flush()

    for item_data in data.items:
        item = await db.get(ChecklistItem, item_data.item_id)
        if item:
            completion = TaskItemCompletion(
                task_id=task.id,
                item_id=item_data.item_id,
                quantity=item_data.quantity,
                points_earned=item.points * item_data.quantity
            )
            db.add(completion)

    await db.commit()
    await db.refresh(task)

    return await get_task_by_id(task.id, db)

async def get_task_by_id(task_id: int, db: AsyncSession):
    task = await db.get(EmployeeTask, task_id)
    employee = await db.get(Employee, task.employee_id)
    checklist = await db.get(TaskChecklist, task.checklist_id)
    room = await db.get(Room, task.room_id) if task.room_id else None

    completions = await db.execute(
        select(TaskItemCompletion).where(TaskItemCompletion.task_id == task.id)
    )
    items = []
    for c in completions.scalars().all():
        item = await db.get(ChecklistItem, c.item_id)
        items.append({
            "item_name": item.name if item else "—",
            "quantity": c.quantity,
            "points": c.points_earned
        })

    return EmployeeTaskResponse(
        id=task.id,
        employee_id=task.employee_id,
        employee_name=employee.full_name,
        checklist_id=task.checklist_id,
        checklist_name=checklist.name,
        room_id=task.room_id,
        room_number=room.room_number if room else None,
        task_date=task.task_date,
        status=task.status,
        total_points=task.total_points,
        total_amount=task.total_amount,
        items_completed=items
    )

@router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(EmployeeTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    task.status = "approved"
    task.approved_at = datetime.utcnow()

    # Создаём запись в финансах
    from app.db.base import FinanceTransaction, FinanceCategory

    # Находим категорию "Зарплата"
    cat_result = await db.execute(select(FinanceCategory).where(FinanceCategory.name == "Зарплата"))
    category = cat_result.scalar_one_or_none()

    if category:
        transaction = FinanceTransaction(
            category_id=category.id,
            type="expense",
            amount=task.total_amount,
            description=f"Зарплата: {task.employee.full_name} - {task.checklist.name}",
            reference_type="salary_task",
            reference_id=task.id
        )
        db.add(transaction)

    await db.commit()
    return {"message": "Задание утверждено", "amount": task.total_amount}

# Отчёт по зарплатам
@router.get("/salary-report", response_model=List[SalaryReportResponse])
async def get_salary_report(
        start_date: str,
        end_date: str,
        position: Optional[str] = None,
        db: AsyncSession = Depends(get_db)
):
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)

    employees_query = select(Employee).where(Employee.is_active == True)
    if position:
        employees_query = employees_query.where(Employee.position == position)

    employees = (await db.execute(employees_query)).scalars().all()

    report = []
    for emp in employees:
        tasks = (await db.execute(
            select(EmployeeTask).where(
                and_(
                    EmployeeTask.employee_id == emp.id,
                    EmployeeTask.status == "approved",
                    EmployeeTask.task_date >= start,
                    EmployeeTask.task_date <= end
                )
            )
        )).scalars().all()

        tasks_completed = len(tasks)
        total_points = sum(t.total_points for t in tasks)
        task_amount = sum(t.total_amount for t in tasks)
        total_salary = emp.base_salary + task_amount

        report.append(SalaryReportResponse(
            employee_id=emp.id,
            employee_name=emp.full_name,
            position=emp.position,
            base_salary=emp.base_salary,
            tasks_completed=tasks_completed,
            total_points=total_points,
            task_amount=task_amount,
            total_salary=total_salary
        ))

    return sorted(report, key=lambda x: x.total_salary, reverse=True)