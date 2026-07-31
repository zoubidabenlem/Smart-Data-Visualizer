#backend\app\routers\datasets\upload.py

import pandas as pd

# FastAPI
from fastapi import APIRouter, Depends, File, UploadFile, status

# SQLAlchemy
from sqlalchemy.orm import Session

# App imports
from app.core.cache import preview_cache
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user, require_admin
from app.models.data_model import DataModel, ModelDataset
from app.models.dataset import Dataset, SourceType
from app.models.user import User
from app.schemas.dataset_schemas import DatasetOut
from app.services.fileUpload_service import extract_metadata, save_upload
from app.services.pipeline.utils import (
    dataframe_to_json_safe,
    preview_cache_key,
    sanitize_records,
)

router = APIRouter()

# ======================================================
# POST /datasets/upload (updated – Phase 1 final)
# ======================================================
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
    # 1. Validate and save the file to disk
    saved_path = save_upload(file)

    # 2. Extract metadata (row/col count, column schema, etc.)
    meta = extract_metadata(saved_path, str(file.content_type))

    # 3. Determine source type
    source_type = SourceType.csv if "csv" in (file.content_type or "") else SourceType.excel

    # 4. Insert the dataset row
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
    db.flush()   # get dataset.id without committing yet

    # 5. Create a single‑table DataModel for this dataset
    model = DataModel(
        user_id=current_user.id,
        name=file.filename,               # or a custom name later
        base_dataset_id=dataset.id,
    )
    db.add(model)
    db.flush()   # get model.id

    # 6. Link dataset to model
    link = ModelDataset(
        model_id=model.id,
        dataset_id=dataset.id,
    )
    db.add(link)
    db.commit()   # now commit everything: dataset, model, link

    # 7. Refresh the ORM instances to get server‑generated values
    db.refresh(dataset)
    db.refresh(model)

    # 8. Cache a preview (as before)
    try:
        if source_type == SourceType.csv:
            df_preview = pd.read_csv(saved_path, nrows=50)
        else:
            df_preview = pd.read_excel(saved_path, nrows=50)

        safe_preview = sanitize_records(dataframe_to_json_safe(df_preview))
        cache_key = preview_cache_key(dataset.id, is_refined=False)
        preview_cache[cache_key] = {"data": safe_preview, "refined": False}
    except Exception:
        pass   # preview generation is non‑critical

    # 9. Return response – include the new model_id so the frontend can use it
    response = DatasetOut.model_validate(dataset)
    response.model_id = model.id
    return response