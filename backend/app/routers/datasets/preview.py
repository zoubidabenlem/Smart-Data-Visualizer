from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.cache import preview_cache, preview_cache_key, refined_cache
from app.core.logging_config import logger
from app.dependencies.auth_dependencies import get_current_user
from app.db.base import get_db
from app.models.dataset import Dataset, SourceType, DatasetStatus
from app.models.user import User
from app.services.dataset_loader import DatasetLoader
from app.services.pipeline.utils import dataframe_to_json_safe, sanitize_records
from app.services.refine_service import get_refined_cache_key

router = APIRouter()

# ======================================================
# GET /datasets/{id}/raw-preview
# ======================================================
@router.get("/{dataset_id}/raw-preview")
async def raw_preview(
    dataset_id: int,
    header_row: int = 0,
    skip_rows: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # --- Branch: MySQL datasets (no file path, header/skip not applicable) ---
    if dataset.source_type == SourceType.mysql:
        try:
            preview_data = DatasetLoader.load_preview(dataset, db)
            columns_list = [col["name"] for col in (dataset.column_schema or [])]
        except Exception as e:
            raise HTTPException(400, f"Could not load MySQL preview: {e}")
        return {
            "columns": columns_list,
            "rows": preview_data,
            "total_rows_estimate": len(preview_data)
        }

    # --- File‑based datasets (existing logic) ---
    file_path = Path(dataset.source_path)
    if not file_path.exists():
        raise HTTPException(400, "File missing")

    skip_list = [int(x) for x in skip_rows.split(",") if x.strip()] if skip_rows else []

    try:
        if dataset.source_type == SourceType.csv:
            try:
                df = pd.read_csv(file_path, header=header_row, skiprows=skip_list, nrows=50)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, header=header_row, skiprows=skip_list, nrows=50, encoding='latin1')
        else:
            df = pd.read_excel(file_path, header=header_row, skiprows=skip_list, nrows=50)

        columns_list = list(df.columns)

        df = dataframe_to_json_safe(df)
        df = sanitize_records(df)

        if isinstance(df, list):
            preview_data = df
        else:
            preview_data = df.to_dict(orient="records")

    except Exception as e:
        raise HTTPException(400, f"Cannot parse: {e}")

    return {
        "columns": columns_list,
        "rows": preview_data,
        "total_rows_estimate": len(preview_data)
    }


# ======================================================
# GET /datasets/{id}/preview
# ======================================================
@router.get("/{dataset_id}/preview", status_code=200)
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch dataset to know if refined and to build correct cache key
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Determine refined status using the status column
    is_refined = dataset.status == DatasetStatus.REFINED

    cache_key = preview_cache_key(dataset_id, is_refined)

    # Check in-memory preview cache
    if cache_key in preview_cache:
        cached_entry = preview_cache[cache_key]
        logger.info(f"Preview cache HIT for dataset_id={dataset_id}, refined={is_refined}")
        return {
            "cached": True,
            "data": cached_entry["data"],
            "refined": cached_entry["refined"]
        }
    else:
        logger.info(f"Preview cache MISS for dataset_id={dataset_id}, refined={is_refined}")

    # If refined dataset but cache missing, try the persistent refined cache
    if is_refined:
        refined_key = get_refined_cache_key(dataset_id)
        if refined_key in refined_cache:
            rows = refined_cache[refined_key][:50]
            safe_rows = sanitize_records(rows) if rows else []
            preview_cache[cache_key] = {"data": safe_rows, "refined": True}
            return {"cached": False, "data": safe_rows, "refined": True}

    # Fallback: load a preview from the original source
    try:
        safe_rows = DatasetLoader.load_preview(dataset, db)
    except Exception as e:
        raise HTTPException(400, f"Could not read dataset: {str(e)}")

    preview_cache[cache_key] = {"data": safe_rows, "refined": False}
    return {"cached": False, "data": safe_rows, "refined": False}


# ======================================================
# GET /datasets/{id}/columns
# ======================================================
@router.get("/{dataset_id}/columns", status_code=200)
def get_dataset_columns(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Use status instead of is_refined flag
    if dataset.status == DatasetStatus.REFINED and dataset.refined_column_schema is not None:
        return {"columns": dataset.refined_column_schema}
    else:
        return {"columns": dataset.column_schema}