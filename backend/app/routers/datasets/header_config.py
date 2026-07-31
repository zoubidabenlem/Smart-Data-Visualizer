#backend\app\routers\datasets\header_config.py
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.cache import preview_cache, preview_cache_key
from app.core.logging_config import logger
from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.dataset import Dataset, DatasetStatus, SourceType
from app.models.user import User
from app.schemas.dataset_schemas import ConfigureHeaderRequest, ConfigureHeaderResponse
from app.services.refine_service import original_df_cache


router = APIRouter()

@router.post(
        "/{dataset_id}/configure-header",
        response_model=ConfigureHeaderResponse,
        dependencies=[Depends(require_admin)])

async def configure_header(
    dataset_id: int,
    config: ConfigureHeaderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.status is DatasetStatus.REFINED:   # probably want to allow header config only before refinement
        raise HTTPException(400, "Dataset already refined; header configuration must happen before refinement")

    # 1. Re‑read the file with new parameters
    file_path = Path(dataset.source_path)
    if not file_path.exists():
        raise HTTPException(400, "Dataset file missing")

    try:
        if dataset.source_type == SourceType.csv:
            df = pd.read_csv(file_path, header=config.header_row, skiprows=config.skip_rows or [])
        elif dataset.source_type == SourceType.excel:
            df = pd.read_excel(file_path, header=config.header_row, skiprows=config.skip_rows or [])
        elif dataset.source_type == SourceType.mysql:
            raise HTTPException(400, "Header configuration is not available for MySQL datasets.")
    except Exception as e:
        raise HTTPException(400, f"Error reading file with new header settings: {e}")

    # 2. Apply manual column name overrides
    if config.column_names:
        df.rename(columns=config.column_names, inplace=True)

    # 3. Save the cleaned file (optional but recommended)
    if dataset.source_type == SourceType.csv:
        new_path = file_path.parent / f"header_fixed_{dataset_id}.csv"
        df.to_csv(new_path, index=False)
    else:
        new_path = file_path.parent / f"header_fixed_{dataset_id}.xlsx"
        df.to_excel(new_path, index=False, engine='openpyxl')

    # 4. Update dataset metadata
    dataset.source_path = str(new_path)
    dataset.header_row = config.header_row
    dataset.skip_rows = config.skip_rows
    dataset.column_schema = [{"name": col, "dtype": str(df[col].dtype)} for col in df.columns]
    dataset.row_count = len(df)
    dataset.col_count = len(df.columns)

    db.commit()

    # 5. Invalidate any stale preview caches
    key_f = preview_cache_key(dataset_id, False)
    key_t = preview_cache_key(dataset_id, True)
    del preview_cache[key_f]
    del preview_cache[key_t]
    # (you might have an invalidate_cache helper; if not, delete from Redis manually)
    # In configure_header, after db.commit()
    logger.info(f"Clearing original_df_cache for dataset {dataset_id}")
    original_df_cache.pop(dataset_id, None)

    return ConfigureHeaderResponse.from_orm(dataset)