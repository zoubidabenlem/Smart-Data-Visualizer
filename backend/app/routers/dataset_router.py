from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
import pandas as pd
import os
from app.services.refine_service import apply_refine_transformations, get_refined_cache_key
from app.core.cache import refined_cache

from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin, get_current_user
from app.models.dataset import Dataset, SourceType
from app.models.user import User
from app.schemas.dataset_schemas import DatasetOut
from app.schemas.refine_schema import *
from app.services.fileUpload_service import save_upload, extract_metadata
from app.core.cache import preview_cache
from app.core.config import settings
#JSON SAFE OBJ FROM DF
from fastapi.encoders import jsonable_encoder
import pandas as pd
import numpy as np

from app.services.pipeline.utils import dataframe_to_json_safe
from app.services.pipeline.utils import sanitize_records
#DATA PREP IMPORTS
from app.services.pipeline.orchestrator import run_pipeline
from app.services.pipeline.utils import get_prepared_cache_key
from app.services.refine_service import get_refined_cache_key
from app.core.cache import prepared_cache, refined_cache, refined_df_cache
from app.schemas.pipeline import PrepareRequest, PrepareResponse

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

        preview_cache[str(dataset.id)] = safe_preview

    except Exception as e:
        # Non‑critical – preview will be generated on first request
        # latr logging the error for debugging
        pass

    db.refresh(dataset)

    return DatasetOut.model_validate(dataset)

    db.refresh(dataset)

    return DatasetOut.model_validate(dataset)

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
# GET /datasets/{id}/preview
@router.get("/{dataset_id}/preview", status_code=200)
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = str(dataset_id)
    if cache_key in preview_cache:
        return {"cached": True, "data": preview_cache[cache_key]}

    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    if dataset.is_refined is True:
        refined_key = get_refined_cache_key(dataset_id)
        if refined_key in refined_cache:
            rows = refined_cache[refined_key][:50]
            safe_rows = sanitize_records(rows) if rows else []

            preview_cache[cache_key] = safe_rows
            return {"cached": False, "data": safe_rows, "refined": True}
        else:
            raise HTTPException(400, "Refined data not in cache. Please re-run refine.")

    # Original file
    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "File missing, please re-upload")

    try:
        if dataset.source_type == SourceType.csv:  # type: ignore
            df = pd.read_csv(file_path, nrows=50)
        else:
            df = pd.read_excel(file_path, nrows=50)

        safe_rows = dataframe_to_json_safe(df)

    except Exception as e:
        raise HTTPException(422, f"Could not read file: {str(e)}")

    preview_cache[cache_key] = safe_rows
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
    #  Prevent re-refinement
    if dataset.is_refined is True:
        raise HTTPException(400, "Dataset already refined")
    ## todo : check with current original name to avoid  action on old col
    # 2. Get source path (as string)
    source_path = dataset.source_path
    if source_path is None:
        raise HTTPException(400, "Dataset file unavailable, please re-upload")
    
    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "Dataset file missing on disk, please re-upload")

    # 3. Read DataFrame
    try:   
        if dataset.source_type == SourceType.csv: #type: ignore
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        elif dataset.source_type == SourceType.excel: #type: ignore
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(400, "Refine not supported for MySQL sources yet")
    except Exception as e:
        raise HTTPException(400, f"Error reading file: {str(e)}")

    # 4. Validate unique new names
    new_names = [a.new_name for a in payload.columns if a.action in ('keep', 'rename') and a.new_name]
    if len(new_names) != len(set(new_names)):
        raise HTTPException(422, "Duplicate new column names are not allowed")

    # 5. Apply transformations
    try:
        refined_df, refined_columns_info = apply_refine_transformations(df, payload.columns)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # 6. Update database
    dataset.is_refined = True          # type: ignore
    dataset.refined_column_schema = [col.dict() for col in refined_columns_info]  # type: ignore
    db.commit()

    # ===================================================================
    # 7. Cache both the raw DataFrame AND the JSON‑safe version
    # ===================================================================
    cache_key = get_refined_cache_key(dataset_id)

    # NEW: Store the original DataFrame for pipeline operations (e.g., prepare)
    # (This prevents the "list has no attribute 'dropna'" error)
    refined_df_cache[cache_key] = refined_df

    # Keep the JSON‑safe version for quick preview responses
    # Uses our helper that replaces NaN/Inf and converts datetimes to strings
    json_safe_data = dataframe_to_json_safe(refined_df)
    # Extra safety: deep‑clean any remaining special floats
    json_safe_data = sanitize_records(json_safe_data)
    refined_cache[cache_key] = json_safe_data

    # (Optional) Immediately populate the preview cache to avoid file reads later
    preview_cache[str(dataset_id)] = json_safe_data[:50]

    # 8. Return
    return RefineSchemaResponse(
        dataset_id=dataset_id,
        refined_columns=refined_columns_info,
        is_refined=True
    )

#API ENDPOINT FOR DATA PREP PHASE 3
@router.post("/{dataset_id}/prepare", response_model=PrepareResponse)
def prepare_dataset(
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

    # 2. Build cache key
    cache_key = get_prepared_cache_key(dataset_id, payload.dict())

    # 3. Check cache
    if cache_key in prepared_cache:
        cached_data = prepared_cache[cache_key]
        return PrepareResponse(
            dataset_id=dataset_id,
            chart_data=cached_data,
            row_count=len(cached_data),
            cached=True
        )

    # ===================================================================
    # 4. Load DataFrame (prefer refined, else original)
    # ===================================================================
    refined_key = get_refined_cache_key(dataset_id)
    # FIXED: Now checks refined_df_cache (DataFrame) instead of refined_cache (list of dicts)
    if (dataset.is_refined is True) and refined_key in refined_df_cache:
        df = refined_df_cache[refined_key]      # <-- Returns a real DataFrame
    else:
        # Load from original source file
        file_path = Path(str(dataset.source_path))
        if not file_path.exists():
            raise HTTPException(400, "Source file missing")
        if dataset.source_type == SourceType.csv:   # type: ignore
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    
    # 5. Run pipeline
    try:
        chart_data = run_pipeline(df, payload)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Pipeline error: {str(e)}")

    # 6. Cache and return
    prepared_cache[cache_key] = chart_data
    return PrepareResponse(
        dataset_id=dataset_id,
        chart_data=chart_data,
        row_count=len(chart_data),
        cached=False
    )