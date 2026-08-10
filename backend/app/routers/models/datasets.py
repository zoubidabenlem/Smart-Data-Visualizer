from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.models.table_relationship import TableRelationship
from app.models.data_model import ModelDataset
from app.models.user import User
from app.schemas.model_schemas import (
    ModelDatasetCreate,
    ModelDatasetOut,
    AddDatasetsToModelRequest,
)
from app.routers.models.utils import get_model_or_404, get_dataset_or_404

router = APIRouter(
    prefix="/models/{model_id}/datasets",
    tags=["model-datasets"]
)

@router.post("/", response_model=List[ModelDatasetOut], status_code=status.HTTP_201_CREATED)
def add_datasets_to_model(
    model_id: int,
    payload: AddDatasetsToModelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    existing_ids = {link.dataset_id for link in model.datasets}
    new_links = []
    for item in payload.datasets:
        dataset = get_dataset_or_404(item.dataset_id, current_user, db)
        if dataset.id in existing_ids:
            raise HTTPException(
                status_code=409,
                detail=f"Dataset '{dataset.filename}' (id={dataset.id}) is already in this model",
            )
        link = ModelDataset(
            model_id=model.id,
            dataset_id=dataset.id,
            alias=item.alias,
        )
        db.add(link)
        new_links.append(link)
        existing_ids.add(dataset.id)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    for link in new_links:
        db.refresh(link)
        db.refresh(link, attribute_names=["dataset"])

    return [ModelDatasetOut.model_validate(link) for link in new_links]

@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_dataset_from_model(
    model_id: int,
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    link = db.query(ModelDataset).filter(
        ModelDataset.model_id == model.id,
        ModelDataset.dataset_id == dataset_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Dataset not found in this model")

    # Cascade delete relationships involving this dataset
    db.query(TableRelationship).filter(
        TableRelationship.model_id == model.id,
        (TableRelationship.left_dataset_id == dataset_id) |
        (TableRelationship.right_dataset_id == dataset_id),
    ).delete()

    db.delete(link)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return None