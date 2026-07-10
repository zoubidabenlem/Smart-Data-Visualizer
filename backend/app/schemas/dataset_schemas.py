from ast import TypeVar

from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Dict, Generic, Optional

from sqlalchemy import Column
from app.models.dataset import SourceType
from typing import List
from sqlalchemy import String
#Column struct
class ColumnInfo(BaseModel):
    name: str
    dtype: str

#Response model after succ upload
class DatasetOut(BaseModel):
    id:int
    filename: str
    source_type: SourceType
    row_count: Optional[int]
    col_count: Optional[int]
    column_schema: Optional[list]
    uploaded_at: datetime
    model_config={"from_attributes": True}  #for pydantic to read sqlAlchemy objs
    source_path: Optional[str] = None
    is_refined: bool                              
    refined_column_schema: Optional[List[ColumnInfo]] = None

#req/res for schema header configuration


class ConfigureHeaderRequest(BaseModel):
    header_row: int = 0
    skip_rows: Optional[List[int]] = []    # rows to skip before the header, e.g. [0,1,2]
    column_names: Optional[Dict[str, str]] = None  # {"Unnamed: 0": "ID", "Unnamed: 1": "Name"}

    @field_validator('header_row')
    def header_row_must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError('header_row must be >= 0')
        return v

class ConfigureHeaderResponse(DatasetOut):
    pass


class PaginatedResponse(BaseModel):
    items: List[DatasetOut]
    total: int
    page: int
    size: int
    pages: int