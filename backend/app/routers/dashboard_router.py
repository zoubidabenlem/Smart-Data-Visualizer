# In dashboard_router.py (or later in a shared helper)
import pandas as pd
from pathlib import Path
from app.models import Dataset
from app.models.dataset import Dataset, SourceType
from app.core.cache import refined_df_cache 
from app.services.refine_service import get_refined_cache_key
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List
import pandas as pd

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import DashboardConfig as Dashboard
from app.models.dataset import Dataset, SourceType   # Adjust imports to your actual enum
from app.schemas.dashboard_schemas import (
    DashboardCreateRequest,
    DashboardUpdateRequest,
    DashboardListItem,
    DashboardResponse,
)
from app.schemas.pipeline import PrepareRequest
from app.services.pipeline.orchestrator import run_pipeline
from app.core.cache import get_cache, set_cache, invalidate_cache
from app.core.logging_config import logger

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

def _load_dataframe(dataset, refined_df_cache) -> pd.DataFrame:

    """
    Return the most up‑to‑date DataFrame for the given dataset.
    Logic:
    - If dataset.is_refined is True and a refined version is cached → use that.
    - Otherwise, read the original file from source_path.
    """
    if dataset.is_refined:
        refined_key = f"refined:{dataset.id}"          # use the same key pattern as your prepare endpoint
        if refined_key in refined_df_cache:
            logger.info(f"Using refined DataFrame for dataset {dataset.id}")
            return refined_df_cache[refined_key]

    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise FileNotFoundError(f"Source file not found: {file_path}")

    if dataset.source_type == SourceType.csv:
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    logger.info(f"Loaded original DataFrame for dataset {dataset.id}, rows={len(df)}")
    return df



######## POST/dashboards ────────────────────────────────────────────────────────────────
@router.post("/", response_model=dict, status_code=201)
def create_dashboard(
    payload: DashboardCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Create a new dashboard.
    The payload.config is already validated by Pydantic (DashboardConfig).
    We store the config JSON and return the new ID.
    """
    # Ensure the dataset referenced exists and belongs to the same user
    dataset = db.query(Dataset).filter(
        Dataset.id == payload.config.dataset_id,
        Dataset.user_id == current_user.id,
    ).first()
    if not dataset:
        raise HTTPException(status_code=400, detail="Dataset not found or access denied")

    new_dash = Dashboard(
        user_id=current_user.id,
        title=payload.config.title,
        dataset_id=payload.config.dataset_id,
        chart_type=payload.config.chart_type,
        x_column=payload.config.x_column,
        y_column=payload.config.y_column,
        config_json=payload.config.dict(),
    )
    db.add(new_dash)
    db.commit()
    db.refresh(new_dash)
    return {"id": new_dash.id}

######## GET/dashboards ───────────────────────────────────────────────────────────────
@router.get("/", response_model=List[DashboardListItem],dependencies=[Depends(require_admin)])
def list_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a list of dashboards owned by the logged-in user.
    Each item contains id, title, chart_type, dataset_id, and created_at.
    """
    dashboards = db.query(Dashboard).filter(
        Dashboard.user_id == current_user.id
    ).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "chart_type": d.config_json.get("chart_type", "unknown"),
            "dataset_id": d.dataset_id,
            "created_at": d.created_at.isoformat(),
        }
        for d in dashboards
    ]

######## GET/dashboards/{id} ─────────────────────────────────────────────────────────
@router.get("/{dashboard_id}", response_model=DashboardResponse, dependencies=[Depends(require_admin)])
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch a dashboard by ID.
    1. Load the saved config.
    2. Check the cache – if a recent pipeline result is cached, return it.
    3. Otherwise, load the dataset, convert config → PrepareRequest, run pipeline.
    4. Cache the result and return.
    """
    # 1. Retrieve dashboard
    dash = db.query(Dashboard).filter(
        Dashboard.id == dashboard_id,
        Dashboard.user_id == current_user.id,
    ).first()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # 2. Cache check
    cache_key = f"dashboard_chart:{dashboard_id}"
    cached = get_cache(cache_key)
    if cached:
        logger.info(f"Cache HIT for {cache_key}")
        return cached

    # 3. Load the dataset
    dataset = db.query(Dataset).get(dash.dataset_id)
    if not dataset:
        raise HTTPException(status_code=400, detail="Dataset not found. Please re-upload.")

    # 4. Build PrepareRequest from the saved config
    config = dash.config_json
    prepare_params = PrepareRequest(
        filters=config.get("filters"),
        group_by=config.get("group_by"),
        agg_func=config.get("agg_func"),
        value_col=config.get("value_col"),
        missing_config=config.get("missing_config"),
    )

    # 5. Load the DataFrame (using the same refined/original logic as prepare endpoint)
    try:
        df = _load_dataframe(dataset, refined_df_cache)
    except FileNotFoundError:
        raise HTTPException(
            status_code=400,
            detail="Dataset file unavailable. Please re-upload the dataset.",
        )

    # 6. Run pipeline (may raise ValueError, caught by FastAPI's default 422)
    chart_data = run_pipeline(df, prepare_params)

    # 7. Build response
    response = {
        "id": dash.id,
        "config": config,
        "chart_data": chart_data,
        "created_at": dash.created_at.isoformat(),
        "updated_at": dash.updated_at.isoformat(),
    }

    # 8. Cache for 5 minutes and return
    set_cache(cache_key, response, ttl=300)
    logger.info(f"Cache SET for {cache_key}")
    return response


# ------------------------------------------------------------------
# PUT /dashboards/{dashboard_id} – Admin only
# ------------------------------------------------------------------
@router.put("/{dashboard_id}")
def update_dashboard(
    dashboard_id: int,
    payload: DashboardUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update a dashboard's title and/or config.
    Invalidate the related cache so the next GET will reflect changes.
    """
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if payload.title is not None and payload.config is None:
        dash.title = payload.title
        if dash.config_json:
            dash.config_json = {**dash.config_json, "title": payload.title}

    if payload.config is not None:
        dash.config_json = payload.config.dict()

    db.commit()
    invalidate_cache(f"dashboard_chart:{dashboard_id}")
    return {"message": "Dashboard updated"}


# ------------------------------------------------------------------
# DELETE /dashboards/{dashboard_id} – Admin only
# ------------------------------------------------------------------
@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Delete a dashboard and invalidate its cache.
    """
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    db.delete(dash)
    db.commit()
    invalidate_cache(f"dashboard_chart:{dashboard_id}")
    return {"message": "Dashboard deleted"}
