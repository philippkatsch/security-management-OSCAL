import os
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from typing import Optional

# Setup password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configurations
SECRET_KEY = os.getenv("REPOSOL_JWT_SECRET", "super-secret-default-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)

def create_access_token(user_id: str, email: str, is_admin: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": user_id,
        "email": email,
        "is_admin": is_admin,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token() -> str:
    return str(uuid.uuid4())

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        if user_id is None or email is None:
            return None
        return {
            "user_id": user_id,
            "email": email,
            "is_admin": payload.get("is_admin", False)
        }
    except JWTError:
        return None
