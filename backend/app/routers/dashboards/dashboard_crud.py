# app/routers/dashboards/dashboard_crud.py
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, Widget
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import (
    DashboardCreateRequest,
    DashboardUpdateRequest,
    DashboardResponse,
    DashboardPaginatedResponse,
    DashboardListItem,
)
from app.core.cache import get_cache, set_cache, invalidate_cache
from app.core.logging_config import logger
from app.routers.dashboards.helpers import get_widget_data_for_dashboard

router = APIRouter()


@router.post("/", response_model=dict, status_code=201)
def create_dashboard(
    payload: DashboardCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        new_dash = Dashboard(user_id=current_user.id, title=payload.title)
        db.add(new_dash)
        db.flush()

        if payload.widgets:
            for wcfg in payload.widgets:
                # Validate DataModel ownership
                model = db.query(DataModel).filter(
                    DataModel.id == wcfg.model_id,
                    DataModel.user_id == current_user.id,
                ).first()
                if not model:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Data model {wcfg.model_id} not found or access denied",
                    )

                widget = Widget(
                    dashboard_id=new_dash.id,
                    model_id=wcfg.model_id,
                    config_json=wcfg.model_dump(),
                    position=None,
                )
                db.add(widget)

        db.commit()
        return {"id": new_dash.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error creating dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=DashboardPaginatedResponse)
def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str = Query("", description="Search in dashboard title"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=10000),
):
    try:
        if current_user.role.name == "admin":
            query = db.query(Dashboard)
        else:
            query = db.query(Dashboard).filter(
                Dashboard.assigned_users.any(id=current_user.id)
            )

        if search:
            query = query.filter(Dashboard.title.ilike(f"%{search}%"))

        total = query.count()
        dashboards = (
            query.order_by(Dashboard.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        items = [
            {
                "id": d.id,
                "title": d.title,
                "created_at": d.created_at.isoformat(),
                "widget_count": len(d.widgets),
            }
            for d in dashboards
        ]

        return DashboardPaginatedResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total else 0,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error listing dashboards")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dash:
            raise HTTPException(404, "Dashboard not found")

        if current_user.role.name != "admin":
            accessible = db.query(Dashboard).filter(
                Dashboard.id == dashboard_id,
                Dashboard.assigned_users.any(id=current_user.id),
            ).first()
            if not accessible:
                raise HTTPException(403, "Access denied")

        cache_key = f"dashboard_response:{dashboard_id}"
        cached = get_cache(cache_key)
        if cached:
            return cached

        widgets_responses = []
        for widget in dash.widgets:
            try:
                widget_data = get_widget_data_for_dashboard(widget, db)
                widgets_responses.append(widget_data)
            except HTTPException:
                raise
            except Exception as e:
                logger.exception(
                    f"Failed to load widget {widget.id} on dashboard {dashboard_id}"
                )
                continue

        response = {
            "id": dash.id,
            "title": dash.title,
            "widgets": widgets_responses,
            "created_at": dash.created_at.isoformat(),
            "updated_at": dash.updated_at.isoformat(),
        }
        set_cache(cache_key, response, ttl=60)
        return response
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error fetching dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{dashboard_id}")
def update_dashboard(
    dashboard_id: int,
    payload: DashboardUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dash or dash.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        if payload.title is not None:
            dash.title = payload.title
        db.commit()
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": "Dashboard updated"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error updating dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dash or dash.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        db.delete(dash)
        db.commit()
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": "Dashboard deleted"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error deleting dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{dashboard_id}/assign/{user_id}", status_code=200)
def assign_dashboard_to_user(
    dashboard_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dashboard:
            raise HTTPException(404, "Dashboard not found")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")

        if user in dashboard.assigned_users:
            raise HTTPException(400, "Already assigned")
        dashboard.assigned_users.append(user)
        db.commit()
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": f"Dashboard {dashboard_id} assigned to user {user_id}"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error assigning dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{dashboard_id}/unassign/{user_id}", status_code=200)
def unassign_dashboard_from_user(
    dashboard_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dashboard:
            raise HTTPException(404, "Dashboard not found")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")

        if user not in dashboard.assigned_users:
            raise HTTPException(400, "Not assigned")
        dashboard.assigned_users.remove(user)
        db.commit()
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": "Unassigned"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error unassigning dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")