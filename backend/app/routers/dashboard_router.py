from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, Widget
from app.models.dataset import Dataset
from app.schemas.dashboard_schemas import (
    DashboardCreateRequest,
    DashboardUpdateRequest,
    DashboardResponse,
    DashboardListItem,
    WidgetCreateRequest,
    WidgetPositionUpdate,
    WidgetUpdateRequest,
    WidgetResponse,
    WidgetConfig,
)
from app.schemas.pipeline import PrepareRequest
from app.services.pipeline.orchestrator import run_pipeline
from app.core.cache import get_cache, set_cache, invalidate_cache, refined_df_cache
from app.core.logging_config import logger
from app.services.pipeline.utils import _load_dataframe, format_chart_data  
from app.models.dashboard import dashboard_assignment  # add this line

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

# ---------- Dashboard CRUD -------_----------------------------------------------------------------
########################################################################################################################
@router.post("/", response_model=dict, status_code=201)
def create_dashboard(
    payload: DashboardCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    new_dash = Dashboard(
        user_id=current_user.id,
        title=payload.title,
    )
    db.add(new_dash)
    db.flush()  # to get new_dash.id

    # Create initial widgets if provided
    if payload.widgets:
        for wcfg in payload.widgets:
            # Verify dataset belongs to user
            dataset = db.query(Dataset).filter(
                Dataset.id == wcfg.dataset_id,
                Dataset.user_id == current_user.id
            ).first()
            if not dataset:
                raise HTTPException(status_code=400, detail=f"Dataset {wcfg.dataset_id} not found or access denied")
            widget = Widget(
                dashboard_id=new_dash.id,
                dataset_id=wcfg.dataset_id,
                config_json=wcfg.dict(),
                position=None
            )
            db.add(widget)
    db.commit()
    return {"id": new_dash.id}

@router.get("/", response_model=List[DashboardListItem])
def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.name == "admin":
        dashboards = db.query(Dashboard).all()
    else:
        dashboards = db.query(Dashboard).filter(
            Dashboard.assigned_users.any(id=current_user.id)
        ).all()

    return [
        {
            "id": d.id,
            "title": d.title,
            "created_at": d.created_at.isoformat(),
            "widget_count": len(d.widgets),
        }
        for d in dashboards
    ]

@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash:
        raise HTTPException(404, "Dashboard not found")

    # Admin: can view any dashboard
    # Viewer: can view only if assigned
    print(current_user.role.name)
     # Admin: can view any dashboard
    if current_user.role.name != "admin":
        accessible = db.query(Dashboard).filter(
            Dashboard.id == dashboard_id,
            Dashboard.assigned_users.any(id=current_user.id)
        ).first()
        if not accessible:
            raise HTTPException(403, "Access denied")
    widgets_responses = []
    for widget in dash.widgets:
        # Compute chart data for each widget (with caching)
        widget_data = _get_widget_data(widget.id, db, current_user)
        widgets_responses.append(widget_data)

    return {
        "id": dash.id,
        "title": dash.title,
        "widgets": widgets_responses,
        "created_at": dash.created_at.isoformat(),
        "updated_at": dash.updated_at.isoformat(),
    }

@router.put("/{dashboard_id}")
def update_dashboard(
    dashboard_id: int,
    payload: DashboardUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash or dash.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if payload.title is not None:
        dash.title = payload.title
    db.commit()
    return {"message": "Dashboard updated"}

@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash or dash.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(dash)
    db.commit()
    return {"message": "Dashboard deleted"}

# Assignment endpoints (admin only) --------------------

@router.post("/{dashboard_id}/assign/{user_id}", status_code=200)
def assign_dashboard_to_user(
    dashboard_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),   # only admin
):
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
    return {"message": f"Dashboard {dashboard_id} assigned to user {user_id}"}

@router.delete("/{dashboard_id}/unassign/{user_id}", status_code=200)
def unassign_dashboard_from_user(
    dashboard_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
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
    return {"message": "Unassigned"}


# ---------- Widget CRUD ----_--------------------------------------------------------------------------------------
######################################################################################################################
def _get_widget_data(widget_id: int, db: Session, current_user: User) -> dict:
    """Helper to fetch a widget with its chart_data (cached)."""
    cache_key = f"widget:{widget_id}"
    cached = get_cache(cache_key)
    if cached:
        logger.info(f"Cache HIT for {cache_key}")
        return cached

    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Verify dashboard ownership
    dashboard = widget.dashboard
    if current_user.role.name != "admin":
        has_access = db.query(Dashboard).filter(
            Dashboard.id == dashboard.id,
            Dashboard.assigned_users.any(id=current_user.id)
        ).first() is not None
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")
        
    dataset = db.query(Dataset).get(widget.dataset_id)
    if not dataset:
        raise HTTPException(status_code=400, detail="Dataset not found")

    config = widget.config_json
    prepare_params = PrepareRequest(
        filters=config.get("filters"),
        group_by=config.get("group_by"),
        agg_func=config.get("agg_func"),
        value_col=config.get("value_col"),
        missing_config=config.get("missing_config"),
    )

    try:
        df = _load_dataframe(dataset, refined_df_cache)  # your existing function
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="Dataset file unavailable")

    chart_data = run_pipeline(df, prepare_params)
    chart_data = format_chart_data(chart_data)   # <-- add this line


    response = {
        "id": widget.id,
        "config": WidgetConfig(**config), 
        "chart_data": chart_data,
        "position": widget.position,
        "created_at": widget.created_at.isoformat(),
        "updated_at": widget.updated_at.isoformat(),
    }
    set_cache(cache_key, response, ttl=300)
    return response

@router.post("/{dashboard_id}/widgets", response_model=dict, status_code=201)
def add_widget(
    dashboard_id: int,
    payload: WidgetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash or dash.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Verify dataset ownership
    dataset = db.query(Dataset).filter(
        Dataset.id == payload.config.dataset_id,
        Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=400, detail="Dataset not found or access denied")

    widget = Widget(
        dashboard_id=dashboard_id,
        dataset_id=payload.config.dataset_id,
        config_json=payload.config.dict(),
        position=payload.position,
    )
    db.add(widget)
    db.commit()
    return {"id": widget.id}

@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=dict)
def update_widget(
    dashboard_id: int,
    widget_id: int,
    payload: WidgetUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.dashboard_id == dashboard_id
    ).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    # Check dashboard ownership
    if widget.dashboard.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.config is not None:
        widget.config_json = payload.config.dict()
        # Optionally update dataset_id if changed
        if payload.config.dataset_id != widget.dataset_id:
            widget.dataset_id = payload.config.dataset_id
    if payload.position is not None:
        widget.position = payload.position

    db.commit()
    invalidate_cache(f"widget:{widget_id}")
    return {"message": "Widget updated"}

@router.delete("/{dashboard_id}/widgets/{widget_id}")
def delete_widget(
    dashboard_id: int,
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    widget = db.query(Widget).filter(
        Widget.id == widget_id,
        Widget.dashboard_id == dashboard_id
    ).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    if widget.dashboard.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(widget)
    db.commit()
    invalidate_cache(f"widget:{widget_id}")
    return {"message": "Widget deleted"}

@router.put("/{dashboard_id}/widgets/positions")
def update_widget_positions(
    dashboard_id: int,
    updates: List[WidgetPositionUpdate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Verify dashboard ownership
    dash = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Process each update
    for upd in updates:
        widget = db.query(Widget).filter(
            Widget.id == upd.widget_id,
            Widget.dashboard_id == dashboard_id
        ).first()
        if not widget:
            raise HTTPException(status_code=404, detail=f"Widget {upd.widget_id} not found")
        widget.position = upd.position

    db.commit()
    # Invalidate all widget caches on this dashboard (optional, but safe)
    for upd in updates:
        invalidate_cache(f"widget:{upd.widget_id}")
    return {"message": f"Updated {len(updates)} widget positions"}
