from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.models.data_model import DataModel
from app.models.user import User

def get_model_or_404(model_id: int, user: User, db: Session) -> DataModel:
    model = db.query(DataModel).filter(
        DataModel.id == model_id,
        DataModel.user_id == user.id
    ).first()
    if not model:
        raise HTTPException(status_code=404, detail="Data model not found")
    return model

def get_dataset_or_404(dataset_id: int, user: User, db: Session) -> Dataset:
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

def validate_columns_exist(dataset: Dataset, column_name: str) -> None:
    col_schema = dataset.column_schema
    if not col_schema and dataset.refined_column_schema:
        col_schema = [{"name": c.name, "dtype": c.dtype} for c in dataset.refined_column_schema]
    if not col_schema:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{dataset.filename}' (id={dataset.id}) has no column schema."
        )
    column_names = [col["name"] for col in col_schema]
    if column_name not in column_names:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{column_name}' not found in dataset '{dataset.filename}' (id={dataset.id})"
        )