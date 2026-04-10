from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@router.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})

@router.get("/admin/rooms", response_class=HTMLResponse)
async def admin_rooms(request: Request):
    return templates.TemplateResponse("admin/rooms.html", {"request": request})

@router.get("/admin/bookings", response_class=HTMLResponse)
async def admin_bookings(request: Request):
    return templates.TemplateResponse("admin/bookings.html", {"request": request})

@router.get("/admin/guests", response_class=HTMLResponse)
async def admin_guests(request: Request):
    return templates.TemplateResponse("admin/guests.html", {"request": request})

@router.get("/admin/settings", response_class=HTMLResponse)
async def admin_settings(request: Request):
    return templates.TemplateResponse("admin/settings.html", {"request": request})

@router.get("/admin/services", response_class=HTMLResponse)
async def admin_services(request: Request):
    return templates.TemplateResponse("admin/services.html", {"request": request})

@router.get("/admin/reports", response_class=HTMLResponse)
async def admin_reports(request: Request):
    return templates.TemplateResponse("admin/reports.html", {"request": request})

@router.get("/admin/inventory", response_class=HTMLResponse)
async def admin_inventory(request: Request):
    return templates.TemplateResponse("admin/inventory.html", {"request": request})

@router.get("/admin/finance", response_class=HTMLResponse)
async def admin_finance(request: Request):
    return templates.TemplateResponse("admin/finance.html", {"request": request})