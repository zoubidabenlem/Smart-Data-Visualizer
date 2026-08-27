# app/routers/models.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.auth_dependencies import get_current_user
from app.db.base import get_db
from app.models.user import User
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import WidgetConfig
from app.services.widget_data_service import get_widget_data

router = APIRouter(prefix="/models", tags=["models"])

@router.post("/{model_id}/prepare", response_model=dict)
def prepare_model_data(
    model_id: int,
    config: WidgetConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Prepare data for a widget configuration.
    The config must belong to the specified model (model_id in path overrides config.model_id if present).
    """
    # Ensure the model exists and user has access
    model = db.query(DataModel).filter(
        DataModel.id == model_id,
        DataModel.user_id == current_user.id  # adjust if multi‑user access
    ).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found or access denied")

    # Force config.model_id to match path (optional)
    config.model_id = model_id

    # Call the widget data service
    chart_data = get_widget_data(model_id, config, db)

    return {
        "model_id": model_id,
        "chart_data": chart_data,
        "row_count": len(chart_data),
    }