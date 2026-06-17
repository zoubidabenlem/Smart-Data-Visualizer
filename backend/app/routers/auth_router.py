from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin
from app.models.role import Role
from app.models.user import User
from app.schemas.auth_schemas import TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and return JWT",
    status_code=status.HTTP_200_OK,
)
def login(body: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Public endpoint.

    1. Look up user by email (case-insensitive).
    2. Verify bcrypt password hash.
    3. Sign a JWT containing `user_id` and `role`.
    4. Return `{ access_token, token_type, role }`.

    Returns **401** for any authentication failure (deliberately vague to
    avoid user-enumeration attacks).
    """
    user = db.query(User).filter(User.email == body.email.lower()).first()

    if not user or not verify_password(body.password, str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact your administrator.",
        )

    token = create_access_token(
        data={"user_id": user.id, "role": user.role.name}
    )
    return TokenResponse(access_token=token, role=user.role.name)


@router.post(
    "/register",
    response_model=UserOut,
    summary="Create a new user account (admin only)",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],  # ← JWT guard applied at route level
)
def register(body: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    """
    Admin-only endpoint.

    1. Validates that the requested `role_id` exists.
    2. Ensures the email address is not already registered.
    3. Hashes the password with bcrypt (cost factor 12).
    4. Inserts the new user row and returns the created record.

    Returns **409** if email already exists.
    Returns **404** if the given `role_id` does not exist.
    Returns **403** if the caller is not an admin.
    """
    # Validate role exists
    role = db.query(Role).filter(Role.id == body.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id={body.role_id} not found",
        )

    # Prevent duplicate emails
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role_id=body.role_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserOut.model_validate(new_user)