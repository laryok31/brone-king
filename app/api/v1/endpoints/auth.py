from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings

router = APIRouter()

# ВРЕМЕННО - простая проверка паролей без bcrypt
def verify_password_simple(plain_password: str, stored_password: str) -> bool:
    return plain_password == stored_password

# Тестовые пользователи с ПРОСТЫМИ паролями
fake_users_db = {
    "admin": {
        "username": "admin",
        "password": "admin",  # Простой пароль
        "role": "admin",
        "full_name": "Администратор"
    },
    "client": {
        "username": "client",
        "password": "client",  # Простой пароль
        "role": "client",
        "full_name": "Клиент"
    }
}

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = fake_users_db.get(form_data.username)
    if not user or not verify_password_simple(form_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")

    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "full_name": user["full_name"]
    }