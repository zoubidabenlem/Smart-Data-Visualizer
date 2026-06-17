from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# ── Request schemas ───────────────────────────────────────────────────────────

class UserLogin(BaseModel):
    """Body for POST /auth/login"""
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserCreate(BaseModel):
    """Body for POST /auth/register  (admin only)"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    role_id: int = Field(..., description="1 = admin, 2 = viewer (must exist in roles table)")


# ── Response schemas ──────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    """Returned on successful login"""
    access_token: str
    token_type: str = "bearer"
    role: str


class UserOut(BaseModel):
    """Returned on successful registration"""
    id: int
    email: EmailStr
    role_id: int
    is_active: bool

    class Config:
        from_attributes = True  # SQLAlchemy → Pydantic (v2 style)


class TokenData(BaseModel):
    """Decoded JWT payload — used internally by dependencies"""
    user_id: Optional[int] = None
    role: Optional[str] = None

# ------ New schemas for user management ------

class UserUpdate(BaseModel):
    """Fields the admin may change (all optional)"""
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class DashboardAssignment(BaseModel):
    """Body for POST /users/{id}/dashboards"""
    dashboard_id: int