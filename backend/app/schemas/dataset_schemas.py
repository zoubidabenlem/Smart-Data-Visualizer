from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
    is_refined: bool                              # ← REQUIRED
    refined_column_schema: Optional[List[ColumnInfo]] = None
