from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from pathlib import Path
import pandas as pd

from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin, get_current_user
from app.models.dataset import Dataset, SourceType
from app.models.user import User
from app.schemas.dataset_schemas import DatasetOut
from app.services.fileUpload_service import save_upload, extract_metadata
from app.core.cache import preview_cache
from app.core.config import settings

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
    )
    db.add(dataset)
    db.commit()
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

# GET /datasets/{id}/preview
@router.get(
    "/{dataset_id}/preview",
    status_code=status.HTTP_200_OK,
    summary="Preview the first 50 rows of a dataset.",
)
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Returns first 50 rows as JSON.
    Result is cached in memory for 5 minutes (TTLCache).
    
    Cache key: "{dataset_id}"
    Cache miss: load file from disk with Pandas, store result, return it.
    Cache hit: return stored result immediately, no disk I/O.
    """
    #check cache
    cache_key = str(dataset_id)
    if cache_key in preview_cache:
        return {"cached": True, "data": preview_cache[cache_key]}
    
    #Fetch dataset metadata from db
    dataset= db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == current_user.id,
    ).first()
    
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    #read file from disk and cache result
        # The file_path is not stored in DB yet — we reconstruct it from the uploads dir TODOd add a file_path column to the Dataset model
    upload_dir = Path(settings.upload_dir)
    # Find the file matching this dataset's filename (uuid prefix + original name)
    matches = list(upload_dir.glob(f"*_{dataset.filename}"))
    if not matches:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk. It may have been deleted.",
        )
    file_path = matches[-1]   # take the most recent if multiple

    # Load first 50 rows
    try:
        if dataset.source_type == SourceType.csv:  # type: ignore
            try:
                df = pd.read_csv(file_path, nrows=50, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, nrows=50, encoding="latin-1")
        else:
            df = pd.read_excel(file_path, nrows=50)

        # Convert to JSON-serializable list of dicts
        rows = df.where(pd.notnull(df), None).to_dict(orient="records")  # type: ignore

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read file: {str(e)}",
        )

    # Store in cache
    preview_cache[cache_key] = rows

    return {"cached": False, "data": rows}
