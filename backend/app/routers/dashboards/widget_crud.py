# app/routers/dashboards/widget_crud.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardPage, Widget
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import (
    WidgetConfig,
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

from app.services.chart_rules import validate_widget_config
from app.services.model_metadata import get_model_column_metadata
from app.services.widget_data_service import get_widget_data

router = APIRouter()


from datetime import datetime


def _build_widget_response(widget: Widget, db: Session) -> WidgetResponse:
    """Compose a WidgetResponse, computing chart_data on the fly."""
    try:
        chart_data = get_widget_data(
            widget.model_id, WidgetConfig(**widget.config_json), db
        )
    except Exception:
        logger.exception("Failed to compute chart_data for widget %s", widget.id)
        chart_data = []

    return WidgetResponse(
        id=widget.id,
        page_id=widget.page_id,        # ← NEW
        config=WidgetConfig(**widget.config_json),
        chart_data=chart_data,
        position=widget.position,
        created_at=widget.created_at.isoformat(),   # ← also add if not present
        updated_at=widget.updated_at.isoformat(),
    )

@router.post("/{dashboard_id}/widgets", response_model=WidgetResponse, status_code=201)
def add_widget(
    dashboard_id: int,
    payload: WidgetCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        if not dash:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        # Resolve page
        target_page_id = payload.page_id
        if target_page_id is None:
            first_page = (
                db.query(DashboardPage)
                .filter(DashboardPage.dashboard_id == dashboard_id)
                .order_by(DashboardPage.order)
                .first()
            )
            if not first_page:
                raise HTTPException(status_code=400, detail="Dashboard has no pages")
            target_page_id = first_page.id
        else:
            page = (
                db.query(DashboardPage)
                .filter(
                    DashboardPage.id == target_page_id,
                    DashboardPage.dashboard_id == dashboard_id,
                )
                .first()
            )
            if not page:
                raise HTTPException(status_code=400, detail="Page not found on this dashboard")

        model = (
            db.query(DataModel)
            .filter(
                DataModel.id == payload.config.model_id,
                DataModel.user_id == current_user.id,
            )
            .first()
        )
        if not model:
            raise HTTPException(status_code=400, detail="Data model not found or access denied")

        model_metadata = get_model_column_metadata(model, db)
        errors = validate_widget_config(payload.config, model_metadata)
        if errors:
            raise HTTPException(status_code=422, detail={"errors": errors})

        widget = Widget(
            dashboard_id=dashboard_id,
            page_id=target_page_id,        # ← NEW
            model_id=payload.config.model_id,
            config_json=payload.config.model_dump(),
            position=payload.position.model_dump() if payload.position else None,
        )
        db.add(widget)
        db.commit()
        db.refresh(widget)

        # Return the full widget WITH chart_data so the frontend can render
        # immediately.
        return _build_widget_response(widget, db)

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error adding widget")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=WidgetResponse)
def update_widget(
    dashboard_id: int,
    widget_id: int,
    payload: WidgetUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        widget = (
            db.query(Widget)
            .filter(Widget.id == widget_id, Widget.dashboard_id == dashboard_id)
            .first()
        )
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")
        if widget.dashboard.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if payload.config is not None:
            model = (
                db.query(DataModel)
                .filter(
                    DataModel.id == payload.config.model_id,
                    DataModel.user_id == current_user.id,
                )
                .first()
            )
            if not model:
                raise HTTPException(status_code=400, detail="Data model not found or access denied")

            model_metadata = get_model_column_metadata(model, db)
            errors = validate_widget_config(payload.config, model_metadata)
            if errors:
                raise HTTPException(status_code=422, detail={"errors": errors})

            widget.config_json = payload.config.model_dump()
            widget.model_id = payload.config.model_id

        if payload.position is not None:
            widget.position = payload.position.model_dump() if payload.position else None

        db.commit()
        db.refresh(widget)

        invalidate_cache(f"widget:{widget_id}")
        invalidate_cache(f"dashboard_response:{dashboard_id}")

        return _build_widget_response(widget, db)

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error updating widget")
        raise HTTPException(status_code=500, detail="Internal server error")


# ... delete_widget and update_widget_position stay as they are ...

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