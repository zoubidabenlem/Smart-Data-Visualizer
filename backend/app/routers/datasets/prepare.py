#backend\app\routers\datasets\prepare.py
import asyncio
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, logger
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.cache import prepared_cache, refined_df_cache
from app.dependencies.auth_dependencies import get_current_user
from app.db.base import get_db
from app.models.dataset import Dataset, DatasetStatus, SourceType
from app.models.user import User
from app.schemas.pipeline import PrepareRequest, PrepareResponse
from app.services.dataset_loader import DatasetLoader
from app.services.pipeline.orchestrator import run_pipeline
from app.services.pipeline.utils import get_prepared_cache_key, sanitize_records
from app.services.pipeline.validation import (
    validate_filters,
    validate_aggregation,
    validate_missing_config,
    PipelineValidationError,
)
from app.services.refine_service import get_refined_cache_key
from app.services.task_manager import create_task, run_in_background

router = APIRouter()

# ==============================================================
#POST /{dataset_id}/prepare - prepare dataset
# ==============================================================
@router.post("/{dataset_id}/prepare", response_model=PrepareResponse)
async def prepare_dataset(
    dataset_id: int,
    payload: PrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify dataset exists and belongs to user
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    
    # Determine refined status once (avoids repeated ORM attribute access)
    is_refined = dataset.status == DatasetStatus.REFINED

    # 2. Branch on size: synchronous for small datasets, async for large ones
    if dataset.row_count < settings.prepare_async_threshold: #type: ignore
        # ========== SYNCHRONOUS PATH (unchanged) ==========
        cache_key = get_prepared_cache_key(dataset_id, payload.dict())

        if cache_key in prepared_cache:
            cached_data = sanitize_records(prepared_cache[cache_key])
            return PrepareResponse(
                dataset_id=dataset_id,
                chart_data=cached_data,
                row_count=len(cached_data),
                cached=True
            )
        else:
            logger.info(f"Cache MISS for dataset_id={dataset_id}, hash={cache_key}")

        # Load DataFrame (prefer refined, else original)
        refined_key = get_refined_cache_key(dataset_id)
        if is_refined and refined_key in refined_df_cache:
            df = refined_df_cache[refined_key]
        else:
            try:
                df = DatasetLoader.load_dataframe(dataset, db)
            except Exception as e:
                raise HTTPException(400, f"Could not load dataset: {e}")

        # Validation block
        dataset_columns = list(df.columns)
        column_dtypes = {str(k): v for k, v in df.dtypes.to_dict().items()}

        try:
            validate_filters(payload.filters, dataset_columns, column_dtypes)
            validate_aggregation(
                payload.group_by,
                payload.agg_func,
                payload.value_col,
                dataset_columns,
                column_dtypes
            )
            if payload.missing_config:
                validate_missing_config(payload.missing_config, dataset_columns, column_dtypes)
        except PipelineValidationError as e:
            raise HTTPException(status_code=422, detail={"errors": e.errors})

        try:
            chart_data = run_pipeline(df, payload)
        except ValueError as e:
            raise HTTPException(422, str(e))
        except Exception as e:
            raise HTTPException(500, f"Pipeline error: {str(e)}")

        chart_data = sanitize_records(chart_data)
        prepared_cache[cache_key] = chart_data
        return PrepareResponse(
            dataset_id=dataset_id,
            chart_data=chart_data,
            row_count=len(chart_data),
            cached=False
        )

    # ========== ASYNC PATH  ==========
    cache_key = get_prepared_cache_key(dataset_id, payload.dict())

    # If the result is already cached, return immediately (still synchronous)
    if cache_key in prepared_cache:
        cached_data = sanitize_records(prepared_cache[cache_key])
        return PrepareResponse(
            dataset_id=dataset_id,
            chart_data=cached_data,
            row_count=len(cached_data),
            cached=True
        )

    # --- Early validation using only the file header (efficient) ---
    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "Source file missing")

    if dataset.source_type == SourceType.csv:  #type: ignore
        df_header = pd.read_csv(file_path, nrows=0)   # reads only column names & dtypes
    else:
        df_header = pd.read_excel(file_path, nrows=0)

    dataset_columns = list(df_header.columns)
    column_dtypes = {str(k): v for k, v in df_header.dtypes.to_dict().items()}

    try:
        validate_filters(payload.filters, dataset_columns, column_dtypes)
        validate_aggregation(
            payload.group_by,
            payload.agg_func,
            payload.value_col,
            dataset_columns,
            column_dtypes
        )
        if payload.missing_config:
            validate_missing_config(payload.missing_config, dataset_columns, column_dtypes)
    except PipelineValidationError as e:
        raise HTTPException(status_code=422, detail={"errors": e.errors})

    # --- Schedule background processing ---
    task_id = await create_task()

    # Capture the refined status (and file path) for the background thread
    _is_refined = is_refined
    _source_type = dataset.source_type
    _source_path = str(dataset.source_path)

    # The function that will run in a background thread
    def process(ds_id: int, payload_dict: dict, key: str):
        # Reconstruct objects (no DB session needed if we load from file/cache)
        payload_obj = PrepareRequest(**payload_dict)

        # Load the full DataFrame (same logic as sync path)
        refined_key = get_refined_cache_key(ds_id)
        # Note: dataset.is_refined is not directly available here; we can store it in closure
        if  _is_refined and refined_key in refined_df_cache:  #type: ignore
            df_full = refined_df_cache[refined_key]
        else:
            file_p = Path(_source_path)
            if _source_type == SourceType.csv:
                df_full = pd.read_csv(file_p)
            else:
                df_full = pd.read_excel(file_p)

        # Run the pipeline
        chart_data = run_pipeline(df_full, payload_obj)
        chart_data = sanitize_records(chart_data)
        prepared_cache[key] = chart_data

    # Fire and forget – the task writes results into prepared_cache when done
    asyncio.create_task(
        run_in_background(
            process,
            ds_id=dataset_id,
            payload_dict=payload.dict(),
            key=cache_key,
            task_id=task_id,
        )
    )

    return JSONResponse(
        status_code=202,
        content={
            "task_id": task_id,
            "status_url": f"/prepare/status/{task_id}",
            "message": "Processing started",
        },
    )