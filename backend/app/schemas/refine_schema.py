from pydantic import BaseModel, field_validator, ValidationInfo   
from typing import List, Optional,Literal

ALLOWED_DTYPES = {"float", "int", "datetime", "string"}

class ColumnRefineAction(BaseModel):
    original_name: str
    action : Literal["rename", "drop", "keep"]
    new_name: Optional[str]=None
    override_dtype: Optional[Literal["float", "int", "datetime", "string"]]=None

    
    @field_validator('new_name')
    def new_name_required_if_keep(cls, v, info: ValidationInfo):
        # Access the already-validated 'action' field via info.data
        if info.data.get('action') == 'keep' and not v:
            raise ValueError('new_name is required when action is "keep"')
        return v
    
class RefineSchemaRequest(BaseModel):
    columns: List[ColumnRefineAction]

class RefinedColumnInfo(BaseModel):
    name: str
    dtype: str

class RefineSchemaResponse(BaseModel):
    dataset_id: int
    refined_columns: List[RefinedColumnInfo]
    is_refined: bool
