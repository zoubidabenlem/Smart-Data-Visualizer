# app/routers/dashboards/widget_crud.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, Widget
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import (
    WidgetCreateRequest,
    WidgetUpdateRequest,
    WidgetResponse,
)
from app.core.cache import invalidate_cache
from app.core.logging_config import logger

# Import validation and metadata services[cite: 4]
from app.services.chart_rules import validate_widget_config
from app.services.model_metadata import get_model_column_metadata

router = APIRouter()


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

        model = db.query(DataModel).filter(
            DataModel.id == payload.config.model_id,
            DataModel.user_id == current_user.id,
        ).first()
        if not model:
            raise HTTPException(status_code=400, detail="Data model not found or access denied")

        # Fetch model metadata and validate widget config[cite: 4]
        model_metadata = get_model_column_metadata(model, db)
        errors = validate_widget_config(payload.config, model_metadata)
        if errors:
            raise HTTPException(
                status_code=422,
                detail={"errors": errors}
            )

        widget = Widget(
            dashboard_id=dashboard_id,
            model_id=payload.config.model_id,
            config_json=payload.config.model_dump(),
            position=payload.position.model_dump() if payload.position else None,
        )
        db.add(widget)
        db.commit()
        # No need to invalidate dashboard cache here because widget is new
        return {"id": widget.id}
    except HTTPException:
        raise
    except Exception:
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
            Widget.dashboard_id == dashboard_id,
        ).first()
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        if widget.dashboard.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if payload.config is not None:
            model = db.query(DataModel).filter(
                DataModel.id == payload.config.model_id,
                DataModel.user_id == current_user.id,
            ).first()
            if not model:
                raise HTTPException(status_code=400, detail="Data model not found or access denied")

            # Fetch model metadata and validate widget config if configuration is updated[cite: 4]
            model_metadata = get_model_column_metadata(model, db)
            errors = validate_widget_config(payload.config, model_metadata)
            if errors:
                raise HTTPException(status_code=422, detail={"errors": errors})

            widget.config_json = payload.config.model_dump()
            widget.model_id = payload.config.model_id

        if payload.position is not None:
            widget.position = payload.position.model_dump() if payload.position else None

        db.commit()
        invalidate_cache(f"widget:{widget_id}")
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": "Widget updated"}
    except HTTPException:
        raise
    except Exception:
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
            Widget.dashboard_id == dashboard_id,
        ).first()
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        if widget.dashboard.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        db.delete(widget)
        db.commit()
        invalidate_cache(f"widget:{widget_id}")
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return {"message": "Widget deleted"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error deleting widget")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/{dashboard_id}/widgets/{widget_id}/position")
def update_widget_position(
    dashboard_id: int,
    widget_id: int,
    position: dict,  # ideally use a Pydantic schema, but keep as is
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        dash = db.query(Dashboard).filter(
            Dashboard.id == dashboard_id, Dashboard.user_id == current_user.id
        ).first()
        if not dash:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        widget = db.query(Widget).filter(
            Widget.id == widget_id, Widget.dashboard_id == dashboard_id
        ).first()
        if not widget:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        widget.position = position
        db.commit()
        invalidate_cache(f"widget:{widget_id}")
        invalidate_cache(f"dashboard_response:{dashboard_id}")
        return widget
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error updating widget position")
        raise HTTPException(status_code=500, detail="Internal server error")