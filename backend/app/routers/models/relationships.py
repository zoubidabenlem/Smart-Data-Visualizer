from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.models.table_relationship import TableRelationship
from app.models.data_model import ModelDataset
from app.models.user import User
from app.schemas.model_schemas import TableRelationshipCreate, TableRelationshipOut
from app.routers.models.utils import (
    get_model_or_404,
    get_dataset_or_404,
    validate_columns_exist,
)

router = APIRouter(
    prefix="/models/{model_id}/relationships",
    tags=["model-relationships"]
)

@router.post("/", response_model=TableRelationshipOut, status_code=status.HTTP_201_CREATED)
def create_relationship(
    model_id: int,
    payload: TableRelationshipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)

    # Ensure both datasets belong to the model
    left_link = db.query(ModelDataset).filter(
        ModelDataset.model_id == model.id,
        ModelDataset.dataset_id == payload.left_dataset_id,
    ).first()
    right_link = db.query(ModelDataset).filter(
        ModelDataset.model_id == model.id,
        ModelDataset.dataset_id == payload.right_dataset_id,
    ).first()
    if not left_link:
        raise HTTPException(400, detail=f"Left dataset (id={payload.left_dataset_id}) is not part of this model")
    if not right_link:
        raise HTTPException(400, detail=f"Right dataset (id={payload.right_dataset_id}) is not part of this model")

    left_ds = get_dataset_or_404(payload.left_dataset_id, current_user, db)
    right_ds = get_dataset_or_404(payload.right_dataset_id, current_user, db)
    validate_columns_exist(left_ds, payload.left_column)
    validate_columns_exist(right_ds, payload.right_column)

    rel = TableRelationship(
        model_id=model.id,
        left_dataset_id=payload.left_dataset_id,
        right_dataset_id=payload.right_dataset_id,
        left_column=payload.left_column,
        right_column=payload.right_column,
        join_type=payload.join_type,
        description=payload.description,
    )
    db.add(rel)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(rel)
    db.refresh(rel, attribute_names=["left_dataset", "right_dataset"])
    return TableRelationshipOut.model_validate(rel)

@router.get("/", response_model=List[TableRelationshipOut])
def list_relationships(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    rels = (
        db.query(TableRelationship)
        .filter(TableRelationship.model_id == model.id)
        .options(
            joinedload(TableRelationship.left_dataset),
            joinedload(TableRelationship.right_dataset),
        )
        .all()
    )
    return [TableRelationshipOut.model_validate(r) for r in rels]

@router.delete("/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_relationship(
    model_id: int,
    relationship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    rel = db.query(TableRelationship).filter(
        TableRelationship.id == relationship_id,
        TableRelationship.model_id == model.id,
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found in this model")
    try:
        db.delete(rel)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return None