from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.models.base import get_db
from app.models.dashboard import Dashboard
from app.models.user import User
from app.schemas.auth_schemas import UserOut, UserUpdate, DashboardAssignment

# NOTE: This router only has admin-only endpoints for user management. Regular users have no "self-service" endpoints (e.g. to update their own email or password) - these would need to be added separately

router = APIRouter(prefix="/users", tags=["users"])
@router.get("/", response_model=list[UserOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()                                                                                                                     

@router.get("/me", response_model=UserOut)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Get the profile of the currently authenticated user.
    Accessible by any logged-in user (admin or viewer).
    """
    return {"id": current_user.id,
        "email": current_user.email,
        "role_id": current_user.role_id,
        "role_name": current_user.role.name,
        "is_active": current_user.is_active,
        }

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Admins can see anyone; regular users can only see themselves
    if current_user.role.name != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut, dependencies=[Depends(require_admin)])
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.email:
        user.email = body.email.lower()
    if body.role_id:
        user.role_id = body.role_id
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return

# Dashboard assignment (admin changes the owner of a dashboard)
@router.post("/{user_id}/dashboards", dependencies=[Depends(require_admin)])
def assign_dashboard(user_id: int, body: DashboardAssignment, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    dashboard = db.query(Dashboard).filter(Dashboard.id == body.dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    dashboard.user_id = user.id   # transfer ownership
    db.commit()
    return {"message": "Dashboard assigned successfully"}



@router.get("/{user_id}/assigned-dashboards", dependencies=[Depends(require_admin)])
def get_user_assigned_dashboards(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return [{"id": d.id, "title": d.title} for d in user.assigned_dashboards]