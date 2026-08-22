from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List

from ..auth.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from ..auth.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES
)
from ..auth.database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _token_lookup_hash(token: str) -> str:
    """Fast non-bcrypt prefix hash for indexed DB lookup (first 16 hex chars of SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()[:16]

@router.post("/register", response_model=UserResponse)
async def register(request: RegisterRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Check if email exists
    async with db.execute("SELECT id FROM users WHERE email = ?", (request.email,)) as cursor:
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
            
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    hashed_pw = hash_password(request.password)
    
    await db.execute(
        """
        INSERT INTO users (id, email, name, password_hash, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, request.email, request.name, hashed_pw, 0, now, now)
    )
    await db.commit()
    
    return UserResponse(
        id=user_id,
        email=request.email,
        name=request.name,
        is_admin=False,
        created_at=now
    )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT id, email, password_hash, is_admin FROM users WHERE email = ?", 
        (request.email,)
    ) as cursor:
        user = await cursor.fetchone()
        
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Clean up expired tokens for this user on login
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.execute("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?", (user["id"], now_iso))
    await db.commit()
        
    access_token = create_access_token(user["id"], user["email"], bool(user["is_admin"]))
    refresh_token = create_refresh_token()
    
    # Store refresh token — keep bcrypt hash for security, plus fast lookup hash
    refresh_id = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    token_hash = hash_password(refresh_token)
    lookup_hash = _token_lookup_hash(refresh_token)
    
    await db.execute(
        """
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (lookup_hash + ":" + refresh_id, user["id"], token_hash, expires_at, now)
    )
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

class RefreshRequest(LoginRequest):
    email: str = ""
    password: str = ""
    refresh_token: str

@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: aiosqlite.Connection = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    lookup_hash = _token_lookup_hash(request.refresh_token)
    
    # Look up only tokens matching the fast lookup hash prefix (indexed)
    async with db.execute(
        "SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE id LIKE ?",
        (lookup_hash + ":%",)
    ) as cursor:
        candidates = await cursor.fetchall()
    
    matched_token = None
    for token in candidates:
        if verify_password(request.refresh_token, token["token_hash"]):
            matched_token = token
            break
        
    if not matched_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    if datetime.fromisoformat(matched_token["expires_at"]) < datetime.now(timezone.utc):
        await db.execute("DELETE FROM refresh_tokens WHERE id = ?", (matched_token["id"],))
        await db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")
        
    # Get user
    async with db.execute("SELECT id, email, is_admin FROM users WHERE id = ?", (matched_token["user_id"],)) as cursor:
        user = await cursor.fetchone()
        
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    access_token = create_access_token(user["id"], user["email"], bool(user["is_admin"]))
    return TokenResponse(
        access_token=access_token,
        refresh_token=request.refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/logout")
async def logout(request: RefreshRequest, db: aiosqlite.Connection = Depends(get_db)):
    """Invalidate a refresh token."""
    lookup_hash = _token_lookup_hash(request.refresh_token)
    
    async with db.execute(
        "SELECT id, token_hash FROM refresh_tokens WHERE id LIKE ?",
        (lookup_hash + ":%",)
    ) as cursor:
        candidates = await cursor.fetchall()
        
    for token in candidates:
        if verify_password(request.refresh_token, token["token_hash"]):
            await db.execute("DELETE FROM refresh_tokens WHERE id = ?", (token["id"],))
            await db.commit()
            break
            
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=dict)
async def get_me(current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT id, email, name, is_admin, created_at FROM users WHERE id = ?", (current_user["user_id"],)) as cursor:
        user = await cursor.fetchone()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    async with db.execute("SELECT workspace_id, role FROM workspace_members WHERE user_id = ?", (user["id"],)) as cursor:
        memberships = await cursor.fetchall()
        
    return {
        "user": dict(user),
        "workspaces": [dict(m) for m in memberships]
    }
