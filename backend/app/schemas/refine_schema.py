from pydantic import BaseModel, field_validator, ValidationInfo, model_validator   
from typing import List, Optional,Literal

ALLOWED_DTYPES = {"float", "int", "datetime", "string"}

class ColumnRefineAction(BaseModel):
    original_name: Optional[str] = None
    action : Literal["rename", "drop", "keep", "missing", "deduplicate"]

    #for rename
    new_name: Optional[str]=None
    #for changing type
    override_dtype: Optional[Literal["float", "int", "datetime", "string"]]=None
     #  for missing
    missing_strategy: Optional[Literal["drop", "fill", "mean"]] = None
    missing_fill_value: Optional[str] = None   # stored as str, coerced if needed
    # for deduplicate
    subset: Optional[List[str]] = None   # list of original column names to consider for duplicates
    keep: Optional[Literal["first", "last", False]] = None
    #validation logic
    @field_validator('original_name')
    def original_name_required_except_deduplicate(cls, v, info):
        if info.data.get('action') != 'deduplicate' and v is None:
            raise ValueError('original_name is required for this action')
        return v
    @field_validator('new_name')
    def new_name_required_if_keep(cls, v, info: ValidationInfo):
        # Access the already-validated 'action' field via info.data
        if info.data.get('action') == 'keep' and not v:
            raise ValueError('new_name is required when action is "keep"')
        return v
    @field_validator('missing_strategy')
    def missing_strategy_required_for_missing(cls, v, info):
        if info.data.get('action') == 'missing' and v is None:
            raise ValueError('missing_strategy is required when action is "missing"')
        return v

    @field_validator('subset')
    def subset_required_for_deduplicate(cls, v, info):
        if info.data.get('action') == 'deduplicate' and (v is None or len(v) == 0):
            raise ValueError('subset must be a non‑empty list when action is "deduplicate"')
        return v

    @field_validator('keep')
    def keep_required_for_deduplicate(cls, v, info):
        if info.data.get('action') == 'deduplicate' and v is None:
            raise ValueError('keep is required when action is "deduplicate"')
        return v
    
class RefineSchemaRequest(BaseModel):
    columns: List[ColumnRefineAction]
    @model_validator(mode='after')
    def validate_deduplicate_count(self):
        dedup_actions = [a for a in self.columns if a.action == 'deduplicate']
        if len(dedup_actions) > 1:
            raise ValueError('Only one deduplicate action is allowed per refinement')
        return self

class RefinedColumnInfo(BaseModel):
    name: str
    dtype: str

class RefineSchemaResponse(BaseModel):
    dataset_id: int
    refined_columns: List[RefinedColumnInfo]
    is_refined: bool
