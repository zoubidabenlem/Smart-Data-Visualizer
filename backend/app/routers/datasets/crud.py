#backend\app\routers\datasets\crud.py
import math
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.models.dataset import Dataset
from app.models.user import User
from app.schemas.dataset_schemas import DatasetOut, PaginatedResponse

router = APIRouter()
# ======================================================
# GET /datasets/ 
# ======================================================
@router.get(
    "/",
    response_model=PaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List all datasets for current user. ",
)
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str = Query("", description="Search in filename"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=10000),
) -> list[DatasetOut]:
    #  Returns all datasets owned by the logged-in user
    # Base query: only current user's datasets
    query = db.query(Dataset).filter(Dataset.user_id == current_user.id)

    # Apply search filter (case-insensitive)
    if search:
        query = query.filter(Dataset.filename.ilike(f"%{search}%"))

    # Get total count before pagination
    total = query.count()

    # Order, offset, limit
    datasets = (
        query.order_by(Dataset.uploaded_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    items = [DatasetOut.model_validate(d) for d in datasets]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )

# ======================================================
# GET datasets/dataset_id/ 
# ======================================================
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

# ======================================================
# DELETE datasets/dataset_id/ 
# ======================================================
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