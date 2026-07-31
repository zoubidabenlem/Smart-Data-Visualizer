#backend\app\routers\datasets\refine_sandbox.py
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.cache import refined_df_cache, refined_cache, preview_cache, preview_cache_key,    get_refined_cache_key

from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.db.base import get_db
from app.models.dataset import Dataset, DatasetStatus, SourceType
from app.models.user import User
from app.schemas.refine_schema import (
    ColumnRefineAction,
    SandboxPreviewResponse,
    RefineSchemaResponse,
    RefinedColumnInfo,
)
from app.services.refine_service import (
    apply_refine_pipeline,
    get_original_df,
    original_df_cache,
)
from app.services.pipeline.utils import dataframe_to_json_safe, sanitize_records
from app.services.sandbox_service import get_sandbox, set_sandbox, clear_sandbox

router = APIRouter()
# ==============================================================
#POST /{dataset_id}/refine/apply-action" - Apply single action
# ==============================================================
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
    # 1. Validate dataset (no restriction on current status)
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # 2. Load sandbox actions
    actions = get_sandbox(dataset_id)
    actions.append(payload)                # add the new action

    # Load original DataFrame
    try:
        df = get_original_df(dataset, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Error reading original file: {str(e)}")

    # Apply the whole pipeline
    try:
        transformed_df = apply_refine_pipeline(df.copy(), actions)  # copy to preserve original
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"message": str(e), "step": len(actions)})

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

# ==============================================================
# DELETE /{dataset_id}/refine/undo" - undo last action
# ==============================================================
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

    actions = get_sandbox(dataset_id)
    if not actions:
        # No actions: return original preview
        try:
            df = get_original_df(dataset,db)
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
        df = get_original_df(dataset,db)
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

# ==============================================================
# POST /{dataset_id}/refine/finalize" - Finalize Refinement
# ==============================================================

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

    actions = get_sandbox(dataset_id)
    if not actions:
        raise HTTPException(400, "No refinement actions to finalize")

    # Load full original DataFrame
    try:
        df = get_original_df(dataset, db)
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
    dataset.status = DatasetStatus.REFINED
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
        status=dataset.status.value   # e.g. "REFINED"

    )
