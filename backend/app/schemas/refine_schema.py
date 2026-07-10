from pydantic import BaseModel, field_validator, ValidationInfo, model_validator   
from typing import Any, Dict, List, Optional,Literal

ALLOWED_DTYPES = {"float", "int", "datetime", "string"}

# -------------------- NEW: Merge Parameters --------------------
class MergeParameters(BaseModel):
    source_columns: List[str]          # columns to merge from (original names)
    target_column: str                 # name of the resulting column
    separator: str = " "               # separator between values
    drop_sources: bool = True          # drop the source columns after merge?

    @field_validator('source_columns')
    def at_least_two_columns(cls, v):
        if len(v) < 2:
            raise ValueError('At least two source columns are required for a merge')
        return v

class ColumnRefineAction(BaseModel):
    action: Literal["rename","cast", "drop", "missing", "deduplicate", "merge"]
    original_name: Optional[str] = None
    new_name: Optional[str] = None
    override_dtype: Optional[Literal["float", "int", "datetime", "string"]] = None
    missing_strategy: Optional[Literal["drop", "fill", "mean"]] = None
    missing_fill_value: Optional[str] = None
    subset: Optional[List[str]] = None
    keep: Optional[Literal["first", "last", False]] = None
    parameters: Optional[MergeParameters] = None

    @model_validator(mode='after')
    def validate_action_requirements(self):
        action = self.action

        # ---- original_name required for most actions ----
        if action not in ('deduplicate', 'merge') and self.original_name is None:
            raise ValueError(f"original_name is required for action '{action}'")

        # ---- merge specific ----
        if action == 'merge':
            if self.parameters is None:
                raise ValueError('parameters object is required for action "merge"')

        # ---- rename specific ----
        if action == 'rename' and not self.new_name:
            raise ValueError('new_name is required when action is "rename"')

        # ---- missing specific ----
        if action == 'missing' and self.missing_strategy is None:
            raise ValueError('missing_strategy is required when action is "missing"')
        if action == 'missing' and self.missing_strategy == 'fill' and self.missing_fill_value is None:
            raise ValueError('missing_fill_value is required for missing strategy "fill"')

        # ---- deduplicate specific ----
        if action == 'deduplicate':
            if not self.subset:
                raise ValueError('subset must be a non‑empty list when action is "deduplicate"')
            if self.keep is None:
                raise ValueError('keep is required when action is "deduplicate"')
            
        if action == 'cast':
            if self.original_name is None:
                raise ValueError("original_name is required for action 'cast'")
            if self.override_dtype is None:
                raise ValueError("override_dtype is required for action 'cast'")
            # Optionally, we can forbid providing new_name (just ignore it or raise)
            # if self.new_name is not None:
            #     raise ValueError("new_name should not be set for action 'cast'")
        return self
    
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

#sequnetial treatmenet 
class SandboxPreviewResponse(BaseModel):
    preview: List[Dict[str, Any]]          # first 50 rows as JSON-safe
    columns: List[RefinedColumnInfo]       # name + dtype
    actions: List[ColumnRefineAction]      # current sandbox actions (for UI recipe)
