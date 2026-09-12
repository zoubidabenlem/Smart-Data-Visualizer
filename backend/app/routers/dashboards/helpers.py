# app/routers/dashboards/helpers.py
import json
from typing import Any, Dict

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.dashboard import Widget
from app.schemas.dashboard_schemas import WidgetConfig
from app.services.widget_data_service import get_widget_data
from app.core.cache import get_cache, set_cache
from app.core.logging_config import logger


def get_widget_data_for_dashboard(widget: Widget, db: Session) -> Dict[str, Any]:
    """
    Fetch chart data for a widget using the new multi‑table service.
    Caches the final response at widget level.
    """
    cache_key = f"widget:{widget.id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    config = widget.config_json
    if isinstance(config, str):
        config = json.loads(config)

    model_id = config.get("model_id")
    if not model_id:
        raise HTTPException(status_code=400, detail="Widget config missing model_id")

    try:
        widget_config = WidgetConfig(**config)
        chart_data = get_widget_data(model_id, widget_config, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing widget {widget.id}")
        raise HTTPException(status_code=500, detail="Error fetching widget data")

    response = {
        "id": widget.id,
        "page_id": widget.page_id,
        "config": widget_config.model_dump(),
        "chart_data": chart_data,
        "position": widget.position,
        "created_at": widget.created_at.isoformat(),
        "updated_at": widget.updated_at.isoformat(),
    }
    set_cache(cache_key, response, ttl=300)
    return response