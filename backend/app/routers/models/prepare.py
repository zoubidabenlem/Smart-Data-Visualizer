# app/routers/models/prepare.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.models.user import User
from app.models.data_model import DataModel
from app.schemas.dashboard_schemas import WidgetConfig
from app.services.model_query_builder import get_chart_data_for_config
from app.core.logging_config import logger

router = APIRouter(prefix="/models", tags=["model-query"])


@router.post("/{model_id}/prepare")
async def prepare_model_data(
    model_id: int,
    config: WidgetConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Prepare chart data for a multi‑table widget configuration.
    This endpoint does not persist anything; it only returns the chart data.
    """
    # 1. Check model ownership
    model = db.query(DataModel).filter(
        DataModel.id == model_id,
        DataModel.user_id == current_user.id,
    ).first()
    if not model:
        raise HTTPException(404, "Data model not found or access denied")

    # 2. Call the service
    try:
        chart_data = get_chart_data_for_config(model_id, config, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error preparing model data")
        raise HTTPException(500, detail="Internal server error while preparing data")

    return {
        "model_id": model_id,
        "chart_data": chart_data,
        "row_count": len(chart_data),
        "cached": False,  # we could include cache info if we wanted
    }