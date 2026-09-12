# app/routers/models.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth_dependencies import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import WidgetConfig
from app.services.widget_data_service import get_widget_data
from app.services.chart_rules import validate_widget_config
from app.services.model_metadata import get_model_column_metadata

router = APIRouter(prefix="/models", tags=["models"])


@router.post("/{model_id}/prepare", response_model=dict)
def prepare_model_data(
    model_id: int,
    config: WidgetConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate the widget config, then prepare its chart data.

    Returns 422 with {"errors": [...]} when the config violates chart rules
    or references columns that do not exist in the model.
    """
    model = (
        db.query(DataModel)
        .filter(DataModel.id == model_id, DataModel.user_id == current_user.id)
        .first()
    )
    if not model:
        raise HTTPException(status_code=404, detail="Model not found or access denied")

    # Path wins over body.
    config.model_id = model_id

    # 1. Validate against chart rules + column metadata BEFORE touching the DB.
    model_metadata = get_model_column_metadata(model, db)
    errors = validate_widget_config(config, model_metadata)
    if errors:
        # Matches the shape used by /dashboards/.../widgets so the frontend
        # can reuse the same error extractor.
        raise HTTPException(status_code=422, detail={"errors": errors})

    # 2. Only now execute the query.
    try:
        chart_data = get_widget_data(model_id, config, db)
    except Exception as exc:  # noqa: BLE001
        # Surface unexpected data-layer failures with a stable contract.
        raise HTTPException(
            status_code=400,
            detail={"errors": [f"Failed to prepare data: {exc}"]},
        ) from exc

    return {
        "model_id": model_id,
        "chart_data": chart_data,
        "row_count": len(chart_data),
    }