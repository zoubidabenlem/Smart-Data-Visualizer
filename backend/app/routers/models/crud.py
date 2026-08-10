from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.db.base import get_db
from app.dependencies.auth_dependencies import get_current_user
from app.models.data_model import DataModel, ModelDataset
from app.models.table_relationship import TableRelationship
from app.models.user import User
from app.schemas.model_schemas import (
    DataModelCreate,
    DataModelUpdate,
    DataModelOut,
    PaginatedModelsOut,
)
from app.routers.models.utils import get_model_or_404

router = APIRouter(prefix="/models", tags=["models"])

@router.get("/", response_model=PaginatedModelsOut)
def list_models(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(DataModel).filter(DataModel.user_id == current_user.id).count()
    models = (
        db.query(DataModel)
        .filter(DataModel.user_id == current_user.id)
        .options(
            joinedload(DataModel.datasets).joinedload(ModelDataset.dataset),
            joinedload(DataModel.relationships),
        )
        .order_by(DataModel.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return PaginatedModelsOut(
        total=total,
        page=page,
        size=size,
        models=[DataModelOut.model_validate(m) for m in models],
    )

@router.post("/", response_model=DataModelOut, status_code=status.HTTP_201_CREATED)
def create_model(
    payload: DataModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = DataModel(
        user_id=current_user.id,
        name=payload.name,
        base_dataset_id=payload.base_dataset_id,
    )
    db.add(model)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(model)
    db.refresh(model, attribute_names=["datasets", "relationships"])
    return DataModelOut.model_validate(model)

@router.get("/{model_id}", response_model=DataModelOut)
def get_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = (
         db.query(DataModel)
        .filter(DataModel.id == model_id, DataModel.user_id == current_user.id)
        .options(
            joinedload(DataModel.datasets).joinedload(ModelDataset.dataset),  # ✅ correct
            joinedload(DataModel.relationships).joinedload(TableRelationship.left_dataset),
            joinedload(DataModel.relationships).joinedload(TableRelationship.right_dataset),
        )
        .first()
    )
    if not model:
        raise HTTPException(status_code=404, detail="Data model not found")
    return DataModelOut.model_validate(model)

@router.put("/{model_id}", response_model=DataModelOut)
def update_model(
    model_id: int,
    payload: DataModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    if payload.name is not None:
        model.name = payload.name
    if payload.base_dataset_id is not None:
        model.base_dataset_id = payload.base_dataset_id
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(model)
    db.refresh(model, attribute_names=["datasets", "relationships"])
    return DataModelOut.model_validate(model)

@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = get_model_or_404(model_id, current_user, db)
    try:
        db.delete(model)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return None