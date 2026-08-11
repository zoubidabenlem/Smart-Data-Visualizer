from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from datetime import datetime
from app.schemas.dataset_schemas import DatasetOut  # after removing model_id


# ------------------ Data Model ------------------
class DataModelCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1024)
    base_dataset_id: Optional[int] = None   # for single‑table compatibility


class DataModelUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1024)
    base_dataset_id: Optional[int] = None


class DataModelOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    user_id: int
    base_dataset_id: Optional[int]
    created_at: datetime
    datasets: List["ModelDatasetOut"] = []      # nested with aliases
    relationships: List["TableRelationshipOut"] = []

    class Config:
        from_attributes = True

class PaginatedModelsOut(BaseModel):
    total: int
    page: int
    size: int
    models: List[DataModelOut]


# ------------------ Model ↔ Dataset Junction ------------------
class ModelDatasetCreate(BaseModel):
    dataset_id: int
    alias: Optional[str] = Field(None, max_length=64)


class ModelDatasetOut(BaseModel):
    dataset_id: int
    alias: Optional[str]
    dataset: DatasetOut   # includes schema, row count, etc.

    class Config:
        from_attributes = True


# ------------------ Table Relationships ------------------
class TableRelationshipCreate(BaseModel):
    left_dataset_id: int
    right_dataset_id: int
    left_column: str = Field(..., max_length=255)
    right_column: str = Field(..., max_length=255)
    join_type: Literal["INNER", "LEFT", "RIGHT", "FULL"]
    cardinality: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"]

    description: Optional[str] = None


class TableRelationshipUpdate(BaseModel):
    left_dataset_id: Optional[int] = None
    right_dataset_id: Optional[int] = None
    left_column: Optional[str] = Field(None, max_length=255)
    right_column: Optional[str] = Field(None, max_length=255)
    join_type: Optional[Literal["INNER", "LEFT", "RIGHT", "FULL"]] = None
    cardinality: Optional[Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"]] = None
    description: Optional[str] = None


class TableRelationshipOut(BaseModel):
    id: int
    model_id: int
    left_dataset_id: int
    right_dataset_id: int
    left_column: str
    right_column: str
    join_type: Literal["INNER", "LEFT", "RIGHT", "FULL"]
    cardinality: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"]
    description: Optional[str]
    # optional nested dataset info
    left_dataset: Optional[DatasetOut] = None
    right_dataset: Optional[DatasetOut] = None

    class Config:
        from_attributes = True


# ------------------ Bulk Add Datasets to Model ------------------
class AddDatasetsToModelRequest(BaseModel):
    datasets: List[ModelDatasetCreate]