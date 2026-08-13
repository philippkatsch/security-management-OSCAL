from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_admin: bool
    created_at: str

class WorkspaceMemberResponse(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    created_at: str

class WorkspaceInviteRequest(BaseModel):
    email: EmailStr
    role: str

class WorkspaceRoleUpdateRequest(BaseModel):
    role: str

class AuditLogEntry(BaseModel):
    id: str
    user_email: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    timestamp: str
    details: Optional[str]
