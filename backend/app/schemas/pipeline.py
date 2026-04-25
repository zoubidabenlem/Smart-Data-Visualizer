from pydantic import BaseModel, Field, field_validator
from typing import List, Optional,Literal,Any

class FilterCondition(BaseModel):
    column: str
    operator: Literal["==", "!=", ">", "<", "in", "like"]
    value: Any

    @field_validator('value', mode='before')
    def parse_value(cls, v, info ):
        if isinstance(v, str) and info.data.get('operator') == 'in':
            try:
                import json
                return json.loads(v)
            except:
                return[item.strip() for item in v.split(',')]
        return v
    
class PrepareRequest(BaseModel):
    missing_strategy: Literal["drop","fill","mean"]="drop"
    fill_value:Optional[Any]=None
    filters:List[FilterCondition]=[]
    group_by: Optional[List[str]] = None
    agg_func: Optional[Literal["SUM", "MEAN", "COUNT"]] = None
    value_col: Optional[str] = None            # required if agg_func is set

    @field_validator('value_col')
    def check_value_col(cls, v, info):
        if info.data.get('agg_func') and not v:
            raise ValueError('value_col is required when aggregation is used')
        return v

class PrepareResponse(BaseModel):
    dataset_id: int
    chart_data: List[dict]          # array of records for Chart.js
    row_count: int
    cached: bool