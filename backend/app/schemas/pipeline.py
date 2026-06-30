from pydantic import BaseModel, Field, field_validator,model_validator
from typing import List, Optional,Literal,Any, Dict, Union



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

class MissingOverride(BaseModel):
    """Per‑column override for missing value strategy."""
    strategy: Literal["drop", "fill", "mean"]
    fill_value: Optional[Union[str, int, float]] = None  # required if strategy == "fill"

class MissingConfig(BaseModel):
    """Top‑level missing value configuration."""
    default: Literal["drop", "fill", "mean"] = "drop"
    default_fill_value: Optional[Union[str, int, float]] = None
    overrides: Optional[Dict[str, Union[str, MissingOverride]]] = Field(default_factory=dict)

    @model_validator(mode='after')
    def check_default_fill_value(self) -> 'MissingConfig':
        """Validate that default_fill_value is present when default strategy is 'fill'."""
        if self.default == "fill" and self.default_fill_value is None:
            raise ValueError("default_fill_value is required when default strategy is 'fill'")
        return self

class AggregationSpec(BaseModel):
    """Specification for multi-value aggregation."""
    value_col: str
    agg_func: Literal["SUM", "MEAN", "COUNT", "MAX", "MIN"]
    alias: Optional[str] = None   # custom output column name

    @field_validator("alias")
    @classmethod
    def alias_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip() == "":
            raise ValueError("Alias cannot be empty string")
        return v

class PrepareRequest(BaseModel):
    #old static to delete when everything works with new configuration
    missing_strategy: Literal["drop","fill","mean"]="drop"
    fill_value:Optional[Any]=None

     # --- new structured configuration ---
    missing_config: Optional[MissingConfig] = None

    # other fields
    filters: List[FilterCondition] = []
    group_by: Optional[List[str]] = None
    agg_func: Optional[Literal["SUM", "MEAN", "COUNT","MAX","MIN"]] = None
    value_col: Optional[str] = None
    aggregations: Optional[List[AggregationSpec]] = None

    @model_validator(mode="after")
    def _normalize_aggregations(self) -> "PrepareRequest":
        # If old single fields are present, convert them to aggregations list
        if self.agg_func and self.value_col:
            if self.aggregations:
                raise ValueError(
                    "Use either 'aggregations' list or the single 'agg_func'/'value_col' pair, not both."
                )
            self.aggregations = [
                AggregationSpec(value_col=self.value_col, agg_func=self.agg_func)
            ]
        elif self.aggregations and (self.agg_func or self.value_col):
            raise ValueError(
                "Use either 'aggregations' list or the single 'agg_func'/'value_col' pair, not both."
            )
        return self

    @field_validator("value_col")
    def check_value_col(cls, v, info):
        # Only enforce if old-style single aggregation is used and no aggregations list
        if v is None and info.data.get("agg_func") and not info.data.get("aggregations"):
            raise ValueError("value_col is required when aggregation is used")
        return v


    @property
    def effective_missing_config(self) -> MissingConfig:
        """
        Return the final missing configuration.
        If missing_config is provided, use it; otherwise build one from the flat parameters.
        """
        if self.missing_config:
            return self.missing_config
        # fallback to old-style
        strat = self.missing_strategy or "drop"
        fill = self.fill_value if strat == "fill" else None
        return MissingConfig(default=strat, default_fill_value=fill)

class PrepareResponse(BaseModel):
    dataset_id: int
    chart_data: List[dict]          # array of records for Chart.js
    row_count: int
    cached: bool