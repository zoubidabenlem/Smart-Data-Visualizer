import asyncio

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pathlib import Path
import pandas as pd
import os
from app.services.refine_service import apply_refine_pipeline, apply_refine_transformations, get_original_df, get_refined_cache_key
from app.core.cache import refined_cache
from app.core.logging_config import logger
from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin, get_current_user
from app.models.dataset import Dataset, SourceType
from app.models.user import User
from app.schemas.dataset_schemas import ConfigureHeaderRequest, ConfigureHeaderResponse, DatasetOut
from app.schemas.refine_schema import *
from app.services.fileUpload_service import save_upload, extract_metadata
from app.core.cache import preview_cache
from app.core.config import settings
#JSON SAFE OBJ FROM DF
from fastapi.encoders import jsonable_encoder
import pandas as pd
import numpy as np
from app.core.redis_client import delete_cache

from app.services.pipeline.utils import dataframe_to_json_safe
from app.services.pipeline.utils import sanitize_records
#DATA PREP IMPORTS
from sqlalchemy import Column
from app.services.pipeline.orchestrator import run_pipeline
from app.services.pipeline.utils import get_prepared_cache_key
from app.services.pipeline.utils import preview_cache_key
##validation imports
from app.services.pipeline.validation import (
    validate_filters,
      validate_aggregation,
        validate_missing_config ,
        validate_refine_deduplicate,
    validate_refine_merge,
        validate_refine_missing,
          PipelineValidationError 
    ) 
from typing import List, Dict, Any, cast
from app.services.refine_service import get_refined_cache_key
from app.core.cache import prepared_cache, refined_cache, refined_df_cache
from app.schemas.pipeline import PrepareRequest, PrepareResponse, MissingConfig, MissingOverride
#async
from app.services.task_manager import task_cache, run_in_background, create_task
from app.services.sandbox_service import clear_sandbox, get_sandbox, set_sandbox
from app.services.refine_service import original_df_cache

router = APIRouter(prefix="/datasets", tags=["Datasets"])
#POST /datasets/upload
@router.post(
    "/upload",
    response_model=DatasetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new dataset : csv or Excel (admin only)",
    dependencies=[Depends(require_admin)],
)
def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetOut:
     # Step 1 + 2: validate and save (raises 415 or 413 on failure)
    saved_path = save_upload(file)

    # Step 3: extract metadata (raises 422 if file is corrupt/unparseable)
    meta = extract_metadata(saved_path,str(file.content_type))

    # Step 4: determine source_type from content_type
    source_type = SourceType.csv if "csv" in (file.content_type or "") else SourceType.excel

    # Step 5: insert row into datasets table
    dataset = Dataset(
        user_id=current_user.id,
        filename=file.filename,
        source_type=source_type,
        row_count=meta["row_count"],
        col_count=meta["col_count"],
        column_schema=meta["column_schema"],
        source_path=str(saved_path), 
    )
    db.add(dataset)
    db.commit()
    # Sanitize preview data and cache it
    try:
        if source_type == SourceType.csv:
            df_preview = pd.read_csv(saved_path, nrows=50)
        else:
            df_preview = pd.read_excel(saved_path, nrows=50)

        # Step 1: Convert DataFrame, replacing NaN/Inf/datetime → Python‑native types
        safe_preview = dataframe_to_json_safe(df_preview)

        # Step 2: Recursive safety net – catch any stray float('nan') or ±inf
        safe_preview = sanitize_records(safe_preview)

         # CACHE store as dict with data and refined flag
        cache_key = preview_cache_key(dataset.id, is_refined=False) #type: ignore
        preview_cache[cache_key] = {"data": safe_preview, "refined": False}
    except Exception as e:
        # Non‑critical – preview will be generated on first request
        pass

    db.refresh(dataset)

    return DatasetOut.model_validate(dataset)

# header configuration
@router.post("/{dataset_id}/configure-header", response_model=ConfigureHeaderResponse, dependencies=[Depends(require_admin)])
async def configure_header(
    dataset_id: int,
    config: ConfigureHeaderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined:   # probably want to allow header config only before refinement
        raise HTTPException(400, "Dataset already refined; header configuration must happen before refinement")

    # 1. Re‑read the file with new parameters
    file_path = Path(dataset.source_path)
    if not file_path.exists():
        raise HTTPException(400, "Dataset file missing")

    try:
        if dataset.source_type == SourceType.csv:
            df = pd.read_csv(file_path, header=config.header_row, skiprows=config.skip_rows or [])
        else:
            df = pd.read_excel(file_path, header=config.header_row, skiprows=config.skip_rows or [])
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

# GET /datasets
@router.get(
    "/",
    response_model=list[DatasetOut],
    status_code=status.HTTP_200_OK,
    summary="List all datasets for current user. ",
)
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DatasetOut]:
    #  Returns all datasets owned by the logged-in user
    datasets=(
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.uploaded_at.desc())
        .all()
    )
    return [DatasetOut.model_validate(dataset) for dataset in datasets]
@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetOut.model_validate(dataset)

#DELETE /{id}
@router.delete("/{dataset_id}", status_code=status.HTTP_200_OK)
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Fetch the dataset ensuring ownership
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. OPTIONAL BUT RECOMMENDED: Delete physical file from disk storage
    if dataset.source_path:
        file_path = Path(str(dataset.source_path))
        try:
            if file_path.exists():
                file_path.unlink()  # Deletes the file
        except Exception as e:
            # Log error but don't block DB deletion if the file is already gone
            print(f"Warning: Could not delete physical file: {e}")

    # 3. Delete records from database
    try:
        db.delete(dataset)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database deletion failed: {str(e)}")

    return {"message": f"Dataset {dataset_id} successfully deleted"}

# GET /datasets/{id}/raw-preview
@router.get("/{dataset_id}/raw-preview")
async def raw_preview(
    dataset_id: int,
    header_row: int = 0,
    skip_rows: str = "",   # comma‑separated list of integers
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    file_path = Path(dataset.source_path)
    if not file_path.exists():
        raise HTTPException(400, "File missing")

    # 1. Safely extract your row configurations
    skip_list = [int(x) for x in skip_rows.split(",") if x.strip()] if skip_rows else []
    
    try:
        # 2. Apply parameters directly to the Pandas readers with encoding fallback paths
        if dataset.source_type == SourceType.csv:  # type: ignore
            try:
                df = pd.read_csv(file_path, header=header_row, skiprows=skip_list, nrows=50)
            except UnicodeDecodeError:
                # Safe fallback if user uploads a Windows/Excel formatted local CSV
                df = pd.read_csv(file_path, header=header_row, skiprows=skip_list, nrows=50, encoding='latin1')
        else:
            df = pd.read_excel(file_path, header=header_row, skiprows=skip_list, nrows=50)
            
        columns_list = list(df.columns)

        # 3. Clean up the dataframe before extraction
        df = dataframe_to_json_safe(df)
        df = sanitize_records(df)
        
        # 4. FIXED: If your cleaning utilities convert the DF into a list of dicts, 
        # do not call .to_dict() again. 
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

# GET /datasets/{id}/preview
@router.get("/{dataset_id}/preview", status_code=200)
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
     # get dataset to know if refined and to build correct cache key
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Determine refined status and build cache key accordingly
    is_refined = dataset.is_refined if hasattr(dataset, 'is_refined') else False
    if isinstance(is_refined, Column):
        is_refined = is_refined.scalar()  # This will retrieve the value from the database    cache_key = preview_cache_key(dataset_id, is_refined)
    cache_key = preview_cache_key(dataset_id, is_refined)
    #  cache now stores a dict with 'data' and 'refined'
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

    # If refined dataset but cache missing, try refined cache
    if is_refined:
        refined_key = get_refined_cache_key(dataset_id)
        if refined_key in refined_cache:
            rows = refined_cache[refined_key][:50]
            safe_rows = sanitize_records(rows) if rows else []
            preview_cache[cache_key] = {"data": safe_rows, "refined": True}
            return {"cached": False, "data": safe_rows, "refined": True}

    # Original file
    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "File missing, please re-upload")

    try:
        if dataset.source_type == SourceType.csv:  # type: ignore
            df = pd.read_csv(file_path, nrows=50)
        else:
            df = pd.read_excel(file_path, nrows=50)

        # Use unified JSON-safe conversion
        safe_rows = dataframe_to_json_safe(df)
        safe_rows = sanitize_records(safe_rows)
    except Exception as e:
        #  Better error code for file corruption
        raise HTTPException(400, f"Could not read file: {str(e)}")

    #  Store with refined=False
    preview_cache[cache_key] = {"data": safe_rows, "refined": False}
    return {"cached": False, "data": safe_rows, "refined": False}

@router.get("/{dataset_id}/columns", status_code=200)
def get_dataset_columns(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined is True and dataset.refined_column_schema is not None:
        return {"columns": dataset.refined_column_schema}
    else:
        return {"columns": dataset.column_schema}
    
@router.post(
    "/{dataset_id}/refine-schema",
    response_model=RefineSchemaResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
    deprecated=True,
)
async def refine_schema(
    dataset_id: int,
    payload: RefineSchemaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Get dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined is True:
        raise HTTPException(400, "Dataset already refined")

    source_path = dataset.source_path
    if source_path is None:
        raise HTTPException(400, "Dataset file unavailable, please re-upload")

    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "Dataset file missing on disk, please re-upload")

    # 3. Read DataFrame
    try:
        if dataset.source_type == SourceType.csv:
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        elif dataset.source_type == SourceType.excel:
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(400, "Refine not supported for MySQL sources yet")
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")

    # 4. Validate unique new names
    #new_names = [a.new_name for a in payload.columns if a.action in ('keep', 'rename') and a.new_name]
    #if len(new_names) != len(set(new_names)):
    #   raise HTTPException(422, "Duplicate new column names are not allowed")

    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    # NEW: Structured validation for missing & deduplicate
    # ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    dataset_columns = list(df.columns)
    column_dtypes = {col: df[col].dtype for col in dataset_columns}

    missing_actions = [a for a in payload.columns if a.action == 'missing']
    dedup_action = next((a for a in payload.columns if a.action == 'deduplicate'), None)

    merge_action = next((a for a in payload.columns if a.action == 'merge'), None)

    try:
        validate_refine_missing(missing_actions, dataset_columns, column_dtypes)
        validate_refine_deduplicate(dedup_action, dataset_columns)
        validate_refine_merge(merge_action, dataset_columns)   # <-- new
    except PipelineValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    
    new_names = []
    for a in payload.columns:
        if a.action in ('keep', 'rename') and a.new_name:
            new_names.append(a.new_name)
        if a.action == 'merge' and a.parameters:
            new_names.append(a.parameters.target_column)
    if len(new_names) != len(set(new_names)):
        raise HTTPException(422, "Duplicate new column names are not allowed")

    # 5. Apply transformations
    try:
        refined_df, refined_columns_info = apply_refine_transformations(df, payload.columns)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # 6. Update database
    dataset.is_refined = True
    dataset.refined_column_schema = [col.dict() for col in refined_columns_info]
    db.commit()

     # ===== NEW: Overwrite the original file with the refined DataFrame =====
    try:
        if dataset.source_type == SourceType.csv:
            # Use the same encoding you originally detected (utf-8, fallback latin-1)
            # For simplicity we stick to utf-8; adjust if you want to preserve original encoding.
            refined_df.to_csv(file_path, index=False, encoding="utf-8")
        elif dataset.source_type == SourceType.excel:
            refined_df.to_excel(file_path, index=False, engine='openpyxl')
        else:
            # MySQL sources are not supported yet, but raise if it ever reaches here
            raise HTTPException(400, "Refine not supported for this source type")

        # Update row and column counts to match refined data (useful if dedup/column drops changed them)
        dataset.row_count = len(refined_df)
        dataset.col_count = len(refined_df.columns)
        db.commit()

        logger.info(f"Refined dataset {dataset_id} written back to {file_path}")
    except Exception as e:
        # Rollback the is_refined flag if the write fails – keep data consistent
        dataset.is_refined = False
        dataset.refined_column_schema = None
        db.commit()
        raise HTTPException(500, f"Failed to persist refined data: {str(e)}")

    # 7. Cache both the raw DataFrame AND the JSON‑safe version (keep as is)
    cache_key = get_refined_cache_key(dataset_id)
    refined_df_cache[cache_key] = refined_df

    logger.info(f"Refine cache stored for dataset_id={dataset_id}, key={cache_key}")

    json_safe_data = dataframe_to_json_safe(refined_df)
    json_safe_data = sanitize_records(json_safe_data)
    refined_cache[cache_key] = json_safe_data

    preview_key = preview_cache_key(dataset_id, is_refined=True)
    preview_cache[preview_key] = {"data": json_safe_data[:50], "refined": True}

    return RefineSchemaResponse(
        dataset_id=dataset_id,
        refined_columns=refined_columns_info,
        is_refined=True
    )

#_______________________________________________________________________________________________Phase 2 REFINEMENT (SANDBOX IMPL)______________________________________________________
#### POST /{dataset_id}/refine/apply-action" - Apply single action
@router.post(
    "/{dataset_id}/refine/apply-action",
    response_model=SandboxPreviewResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def apply_refine_action(
    dataset_id: int,
    payload: ColumnRefineAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined:
        raise HTTPException(400, "Dataset already refined")

    # Load sandbox actions
    actions = get_sandbox(dataset_id)
    actions.append(payload)                # add the new action

    # Load original DataFrame
    try:
        df = get_original_df(dataset)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Error reading original file: {str(e)}")

    # Apply the whole pipeline
    try:
        transformed_df = apply_refine_pipeline(df.copy(), actions)  # copy to preserve original
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Save updated actions back to sandbox
    set_sandbox(dataset_id, actions)

    # Generate preview
    preview_data = dataframe_to_json_safe(transformed_df.head(50))
    preview_data = sanitize_records(preview_data)

    columns_info = [
        RefinedColumnInfo(name=col, dtype=str(transformed_df[col].dtype))
        for col in transformed_df.columns
    ]

    return SandboxPreviewResponse(
        preview=preview_data,
        columns=columns_info,
        actions=actions,
    )

#### DELETE /{dataset_id}/refine/undo" - undo last actionç
@router.delete(
    "/{dataset_id}/refine/undo",
    response_model=SandboxPreviewResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def undo_refine_action(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined:
        raise HTTPException(400, "Dataset already refined")

    actions = get_sandbox(dataset_id)
    if not actions:
        # No actions: return original preview
        try:
            df = get_original_df(dataset)
        except Exception as e:
            raise HTTPException(400, f"Error reading file: {str(e)}")
        preview_data = dataframe_to_json_safe(df.head(50))
        preview_data = sanitize_records(preview_data)
        columns_info = [RefinedColumnInfo(name=col, dtype=str(df[col].dtype)) for col in df.columns]
        return SandboxPreviewResponse(preview=preview_data, columns=columns_info, actions=[])

    # Pop last action
    actions.pop()
    set_sandbox(dataset_id, actions)  # save updated list (could be empty)

    try:
        df = get_original_df(dataset)
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")

    if actions:
        try:
            transformed_df = apply_refine_pipeline(df.copy(), actions)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        transformed_df = df

    preview_data = dataframe_to_json_safe(transformed_df.head(50))
    preview_data = sanitize_records(preview_data)
    columns_info = [RefinedColumnInfo(name=col, dtype=str(transformed_df[col].dtype)) for col in transformed_df.columns]

    return SandboxPreviewResponse(
        preview=preview_data,
        columns=columns_info,
        actions=actions,
    )

#### POST /{dataset_id}/refine/finalize" - Finalize Refinement
@router.post(
    "/{dataset_id}/refine/finalize",
    response_model=RefineSchemaResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def finalize_refinement(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.is_refined:
        raise HTTPException(400, "Dataset already refined")

    actions = get_sandbox(dataset_id)
    if not actions:
        raise HTTPException(400, "No refinement actions to finalize")

    # Load full original DataFrame
    try:
        df = get_original_df(dataset)
    except Exception as e:
        raise HTTPException(400, f"Error reading original file: {str(e)}")

    # Apply pipeline
    try:
        refined_df = apply_refine_pipeline(df.copy(), actions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Overwrite the original file with refined data
    file_path = Path(str(dataset.source_path))
    try:
        if dataset.source_type == SourceType.csv:
            refined_df.to_csv(file_path, index=False, encoding="utf-8")
        elif dataset.source_type == SourceType.excel:
            refined_df.to_excel(file_path, index=False, engine='openpyxl')
    except Exception as e:
        raise HTTPException(500, f"Failed to persist refined data: {str(e)}")

    # Update dataset metadata
    dataset.is_refined = True
    dataset.refined_column_schema = [
        {"name": col, "dtype": str(refined_df[col].dtype)} for col in refined_df.columns
    ]
    dataset.row_count = len(refined_df)
    dataset.col_count = len(refined_df.columns)
    db.commit()

    # Cache refined data (overwrite any stale caches)
    cache_key = get_refined_cache_key(dataset_id)
    refined_df_cache[cache_key] = refined_df
    json_safe = dataframe_to_json_safe(refined_df)
    json_safe = sanitize_records(json_safe)
    refined_cache[cache_key] = json_safe
    preview_key = preview_cache_key(dataset_id, is_refined=True)
    preview_cache[preview_key] = {"data": json_safe[:50], "refined": True}

    # Clear sandbox
    clear_sandbox(dataset_id)
    # Remove original df cache (free memory)
    if dataset_id in original_df_cache:
        del original_df_cache[dataset_id]

    return RefineSchemaResponse(
        dataset_id=dataset_id,
        refined_columns=[RefinedColumnInfo(name=col, dtype=str(refined_df[col].dtype)) for col in refined_df.columns],
        is_refined=True,
    )

#______________________________________________________________________________________________________________________________________________________________________________________


#API ENDPOINT FOR DATA PREP PHASE 3
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
        if (dataset.is_refined is True) and refined_key in refined_df_cache:
            df = refined_df_cache[refined_key]
        else:
            file_path = Path(str(dataset.source_path))
            if not file_path.exists():
                raise HTTPException(400, "Source file missing")
            if dataset.source_type == SourceType.csv: #type: ignore
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)

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

    # ========== ASYNC PATH (new) ==========
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

    # The function that will run in a background thread
    def process(ds_id: int, payload_dict: dict, key: str):
        # Reconstruct objects (no DB session needed if we load from file/cache)
        payload_obj = PrepareRequest(**payload_dict)

        # Load the full DataFrame (same logic as sync path)
        refined_key = get_refined_cache_key(ds_id)
        # Note: dataset.is_refined is not directly available here; we can store it in closure
        if dataset.is_refined and refined_key in refined_df_cache:  #type: ignore
            df_full = refined_df_cache[refined_key]
        else:
            if dataset.source_type == SourceType.csv:  #type: ignore
                df_full = pd.read_csv(file_path)
            else:
                df_full = pd.read_excel(file_path)

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