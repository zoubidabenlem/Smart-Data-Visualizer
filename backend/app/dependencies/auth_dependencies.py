from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session
from sqlalchemy import Boolean
from app.core.security import decode_access_token
from app.db.base import get_db
from app.models.user import User
from app.schemas.auth_schemas import TokenData
from typing import Optional
from fastapi import Request
# Extracts "Bearer <token>" from the Authorization header
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency — decodes the JWT, fetches the User row from DB.
    Raises HTTP 401 on any failure (missing token, expired, bad signature,
    user not found, account disabled).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: int = payload.get("user_id",2)
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, role=payload.get("role"))
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    if  user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency — additionally checks that the authenticated user has the admin role.
    Raises HTTP 403 if the user is a viewer.
    """
    if current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

async def get_current_user_optional(request: Request) -> Optional[User]:
    """
    Return User if valid JWT in Authorization header, else None.
    Uses the same decode_access_token as get_current_user.
    """
    # Extract token from header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1].strip()
    if not token:
        return None

    # Decode token using your existing security function
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            return None
    except JWTError:
        return None

    # Get a DB session manually (as middleware doesn't have Depends)
    db_gen = get_db()
    db = next(db_gen)
    try:
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except Exception:
        return None
    finally:
        db.close()