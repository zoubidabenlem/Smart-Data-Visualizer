import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
import traceback

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
from app.services.pipeline.utils import _load_dataframe, format_chart_data, get_prepared_cache_key
from app.models.dashboard import dashboard_assignment
from app.core.config import Settings, settings  # add this line

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

# ---------- Dashboard CRUD ------------------------------------------------------------------
@router.post("/", response_model=dict, status_code=201)
def create_dashboard(
    payload: DashboardCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
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
    except HTTPException:
        raise  # re-raise intended client errors
    except Exception as e:
        logger.exception("Unexpected error creating dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=List[DashboardListItem])
def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
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

        # Admin: can view any dashboard
        # Viewer: can view only if assigned
        if current_user.role.name != "admin":
            accessible = db.query(Dashboard).filter(
                Dashboard.id == dashboard_id,
                Dashboard.assigned_users.any(id=current_user.id)
            ).first()
            if not accessible:
                raise HTTPException(403, "Access denied")
            
        cache_key = f"dashboard_response:{dashboard_id}"
        cached = get_cache(cache_key)
        if cached:
            logger.info(f"Dashboard cache HIT for {dashboard_id}")
            return cached

        # ---- Load all datasets needed by this dashboard once ----
        dataset_ids = {w.dataset_id for w in dash.widgets}
        dataset_cache = {}   # dataset_id -> (DataFrame, updated_at_timestamp)
        for ds_id in dataset_ids:
            ds = db.query(Dataset).get(ds_id)
            if ds:
                df = _load_dataframe(ds, refined_df_cache)   # already uses refined if available
                dataset_cache[ds_id] = (df, ds.uploaded_at.timestamp())   # float epoch seconds
        
        widgets_responses = []
        for widget in dash.widgets:
            try:
                # Compute chart data for each widget (with caching)
                widget_data = _get_widget_data_v2(widget, dataset_cache)
                widgets_responses.append(widget_data)
            except HTTPException:
                raise  # let endpoint handle upstream
            except Exception as e:
                # Log the full traceback for diagnosis
                logger.exception(f"Failed to load widget {widget.id} on dashboard {dashboard_id}")
                # Optionally, you could still continue or skip the widget
                # Here we skip the faulty widget to keep the dashboard stable
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
    except Exception as e:
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
        return {"message": "Dashboard updated"}
    except HTTPException:
        raise
    except Exception as e:
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
        return {"message": "Dashboard deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error deleting dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


# Assignment endpoints (admin only) --------------------
@router.post("/{dashboard_id}/assign/{user_id}", status_code=200)
def assign_dashboard_to_user(
    dashboard_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),   # only admin
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
        return {"message": f"Dashboard {dashboard_id} assigned to user {user_id}"}
    except HTTPException:
        raise
    except Exception as e:
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
        return {"message": "Unassigned"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error unassigning dashboard")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------- Widget CRUD ---------------------------------------------------------------------
def _get_widget_data(widget_id: int, db: Session, current_user: User) -> dict:
    """Helper to fetch a widget with its chart_data (cached)."""
    try:
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

         # Extract config and keep an untouched copy for the final response
        raw_config = widget.config_json
        config = raw_config.copy() if hasattr(raw_config, "copy") else dict(raw_config)

        # Normalise old aggregation fields into aggregations list if present
        if config.get("agg_func") and config.get("value_col") and not config.get("aggregations"):
            config["aggregations"] = [
                {"value_col": config["value_col"], "agg_func": config["agg_func"]}
            ]
        # Remove the old fields to avoid confusion (PrepareRequest won't need them)
        config.pop("agg_func", None)
        config.pop("value_col", None)

        # Safely instantiate using the cleaned, unpacked dictionary
        prepare_params = PrepareRequest(**config)

        df = _load_dataframe(dataset, refined_df_cache)  # your existing function
        chart_data = run_pipeline(df, prepare_params)
        chart_data = format_chart_data(chart_data)


        response = {
            "id": widget.id,
            "config": WidgetConfig(**raw_config).dict(),
            "chart_data": chart_data,
            "position": widget.position,
            "created_at": widget.created_at.isoformat(),
            "updated_at": widget.updated_at.isoformat(),
        }
        set_cache(cache_key, response, ttl=300)
        return response
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="Dataset file unavailable")
    except Exception as e:
        logger.exception(f"Unexpected error in _get_widget_data for widget {widget_id}")
        raise HTTPException(status_code=500, detail="Error fetching widget data")
def _get_widget_data_cached(
    widget: Widget,
    db: Session,
    current_user: User,
    dataset_cache: Dict[int, pd.DataFrame]
) -> dict:
    # 1. Widget‑level cache (the whole response including widget metadata)
    widget_key = f"widget:{widget.id}"
    cached = get_cache(widget_key)
    if cached:
        logger.info(f"Widget cache HIT for {widget_key}")
        return cached

    # 2. Dataset must be in the cache (already loaded)
    df = dataset_cache.get(widget.dataset_id)
    if df is None:
        raise HTTPException(status_code=400, detail="Dataset not found for widget")

    # 3. Build prepare params from widget config (normalise aggregations)
    config = widget.config_json
    if config.get("agg_func") and config.get("value_col") and not config.get("aggregations"):
        config["aggregations"] = [
            {"value_col": config["value_col"], "agg_func": config["agg_func"]}
        ]
        config.pop("agg_func", None)
        config.pop("value_col", None)

    prepare_params = PrepareRequest(**config)

    # 4. Prepared data cache (shared across widgets with same params)
    params_dict = prepare_params.dict(exclude_none=True)
    prepared_key = get_prepared_cache_key(widget.dataset_id, params_dict)
    chart_data = get_cache(prepared_key)

    if chart_data is None:
        # Compute and store in Redis (TTL from settings)
        chart_data = run_pipeline(df, prepare_params)
        set_cache(prepared_key, chart_data, ttl=Settings.cache_ttl_seconds)

    # 5. Format
    chart_data = format_chart_data(chart_data)

    # 6. Build final response
    response = {
        "id": widget.id,
        "config": WidgetConfig(**config).dict(),
        "chart_data": chart_data,
        "position": widget.position,
        "created_at": widget.created_at.isoformat(),
        "updated_at": widget.updated_at.isoformat(),
    }
    set_cache(widget_key, response, ttl=300)
    return response
###helper
def _get_widget_data_v2(widget, dataset_cache):
    # 1. Widget‑level cache (fast‑path for unchanged widgets)
    widget_key = f"widget:{widget.id}"
    cached = get_cache(widget_key)
    if cached:
        return cached

    # 2. Retrieve pre‑loaded DataFrame and dataset version
    df, ds_updated_ts = dataset_cache[widget.dataset_id]

    # 3. Normalise config and build prepared cache key
    config = widget.config_json.copy()
    # ... normalise aggregations as before ...
    params_hash = hashlib.md5(
        json.dumps(config, sort_keys=True, default=str).encode()
    ).hexdigest()
    prepared_key = f"prepare:{widget.dataset_id}:{ds_updated_ts}:{params_hash}"

    # 4. Fetch or compute chart_data
    chart_data = get_cache(prepared_key)
    if chart_data is None:
        prepare_params = PrepareRequest(**config)
        chart_data = run_pipeline(df, prepare_params)
        set_cache(prepared_key, chart_data, ttl=settings.cache_ttl_seconds)

    # 5. Format and build final response
    chart_data = format_chart_data(chart_data)
    response = {
        "id": widget.id,
        "config": WidgetConfig(**config).dict(),
        "chart_data": chart_data,
        "position": widget.position,
        "created_at": widget.created_at.isoformat(),
        "updated_at": widget.updated_at.isoformat(),
    }
    set_cache(widget_key, response, ttl=300)
    return response
@router.post("/{dashboard_id}/widgets", response_model=dict, status_code=201)
def add_widget(
    dashboard_id: int,
    payload: WidgetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error adding widget")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=dict)
def update_widget(
    dashboard_id: int,
    widget_id: int,
    payload: WidgetUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error updating widget")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{dashboard_id}/widgets/{widget_id}")
def delete_widget(
    dashboard_id: int,
    widget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error deleting widget")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{dashboard_id}/widgets/positions")
def update_widget_positions(
    dashboard_id: int,
    updates: List[WidgetPositionUpdate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error updating widget positions")
        raise HTTPException(status_code=500, detail="Internal server error")