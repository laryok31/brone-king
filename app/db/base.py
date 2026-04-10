from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class RoomStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    CLEANING = "cleaning"
    MAINTENANCE = "maintenance"

class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"

class GuestType(str, enum.Enum):
    REGULAR = "regular"
    VIP = "vip"
    CORPORATE = "corporate"

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(10), unique=True, nullable=False)
    floor = Column(Integer, nullable=False)
    room_type = Column(String(50), nullable=False)
    capacity = Column(Integer, default=2)
    price_per_night = Column(Float, nullable=False)
    weekend_price = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, default=list)
    status = Column(String(20), default=RoomStatus.AVAILABLE.value)
    square_meters = Column(Float, nullable=True)
    has_balcony = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="room")

class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    passport_series = Column(String(4), nullable=True)
    passport_number = Column(String(6), nullable=True)
    birth_date = Column(DateTime, nullable=True)
    citizenship = Column(String(100), default="RU")
    address = Column(Text, nullable=True)
    guest_type = Column(String(20), default=GuestType.REGULAR.value)
    notes = Column(Text, nullable=True)
    blacklisted = Column(Boolean, default=False)
    total_stays = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="guest")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String(20), unique=True, nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    check_in_date = Column(DateTime, nullable=False)
    check_out_date = Column(DateTime, nullable=False)
    adults = Column(Integer, default=2)
    children = Column(Integer, default=0)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    status = Column(String(20), default=BookingStatus.PENDING.value)
    source = Column(String(50), default="direct")
    special_requests = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("Room", back_populates="bookings")
    guest = relationship("Guest", back_populates="bookings")

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    category = Column(String(50), nullable=False, default="other")
    unit = Column(String(20), default="услуга")  # услуга, час, день, человек
    is_active = Column(Boolean, default=True)
    is_popular = Column(Boolean, default=False)
    icon = Column(String(50), nullable=True)  # иконка FontAwesome
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class InventoryCategory(Base):
    __tablename__ = "inventory_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="fa-box")
    color = Column(String(20), default="#6366f1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("inventory_categories.id"))
    name = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, nullable=True)
    unit = Column(String(20), default="шт")
    current_stock = Column(Float, default=0)
    minimum_stock = Column(Float, default=10)
    maximum_stock = Column(Float, default=100)
    purchase_price = Column(Float, default=0)
    selling_price = Column(Float, default=0)
    supplier = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("InventoryCategory")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"))
    movement_type = Column(String(20), nullable=False)  # in, out, adjustment, waste
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    reference_type = Column(String(50), nullable=True)  # purchase, sale, transfer, waste
    reference_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("InventoryItem")

class FinanceCategory(Base):
    __tablename__ = "finance_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)  # income, expense
    icon = Column(String(50), default="fa-circle")
    color = Column(String(20), default="#6366f1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FinanceTransaction(Base):
    __tablename__ = "finance_transactions"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("finance_categories.id"))
    type = Column(String(20), nullable=False)  # income, expense
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    reference_type = Column(String(50), nullable=True)  # booking, inventory, salary, utility, etc.
    reference_id = Column(Integer, nullable=True)
    payment_method = Column(String(50), default="cash")  # cash, card, transfer
    status = Column(String(20), default="completed")  # pending, completed, cancelled
    transaction_date = Column(DateTime(timezone=True), default=func.now())
    created_by = Column(String(100), default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("FinanceCategory")

class Salary(Base):
    __tablename__ = "salaries"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String(200), nullable=False)
    position = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    bonus = Column(Float, default=0)
    deductions = Column(Float, default=0)
    total = Column(Float, nullable=False)
    payment_date = Column(DateTime(timezone=True), default=func.now())
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="paid")  # pending, paid
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False)
    position = Column(String(100), nullable=False)  # maid, receptionist, manager, etc.
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    base_salary = Column(Float, default=0)  # оклад
    hourly_rate = Column(Float, default=0)  # почасовая ставка
    is_active = Column(Boolean, default=True)
    hire_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TaskChecklist(Base):
    __tablename__ = "task_checklists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    position = Column(String(100), nullable=False)  # для какой должности
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("task_checklists.id"))
    name = Column(String(200), nullable=False)
    points = Column(Float, default=1.0)  # баллы/оплата за выполнение
    unit = Column(String(20), default="шт")  # шт, раз, комната
    order_num = Column(Integer, default=0)

    checklist = relationship("TaskChecklist")

class EmployeeTask(Base):
    __tablename__ = "employee_tasks"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    checklist_id = Column(Integer, ForeignKey("task_checklists.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    task_date = Column(DateTime(timezone=True), default=func.now())
    status = Column(String(20), default="pending")  # pending, completed, approved
    notes = Column(Text, nullable=True)
    total_points = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    approved_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
    checklist = relationship("TaskChecklist")
    room = relationship("Room")

class TaskItemCompletion(Base):
    __tablename__ = "task_item_completions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("employee_tasks.id"))
    item_id = Column(Integer, ForeignKey("checklist_items.id"))
    quantity = Column(Float, default=1)
    points_earned = Column(Float, default=0)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("EmployeeTask")
    item = relationship("ChecklistItem")