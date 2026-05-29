from typing import Any, Dict, Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.pipeline import FilterCondition, MissingConfig


ALLOWED_CHART_TYPES = {"bar", "line", "pie", "scatter", "area", "heatmap","kpi"}

class WidgetConfig(BaseModel):
    dataset_id: int
    chart_type: Literal["bar", "line", "pie", "scatter", "area", "heatmap","kpi"]
    title: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    filters: List[FilterCondition] = Field(default_factory=list)  # defaults to empty list
    group_by: Optional[List[str]] = None
    agg_func: Optional[Literal["SUM", "MEAN", "COUNT","MAX","MIN"]] = None
    value_col: Optional[str] = None
    missing_config: Optional[MissingConfig] = None
    color_scheme: str = "default"  # consistent naming with default value

    # Optional: keep validators for custom logic (though Literal already catches invalid values)
    @field_validator("chart_type")
    @classmethod
    def validate_chart_type(cls, v: str) -> str:
        if v not in ALLOWED_CHART_TYPES:
            raise ValueError(f"Invalid chart type: {v}. Allowed types: {ALLOWED_CHART_TYPES}")
        return v

    @field_validator("agg_func")
    @classmethod
    def validate_agg_func(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.upper() not in {"SUM", "MEAN", "COUNT", "MAX", "MIN"}:
            raise ValueError(f"Invalid aggregation function: {v}. Allowed: SUM, MEAN, COUNT, MAX, MIN")
        return v.upper() if v else None

    @model_validator(mode="after")
    def check_aggregation_consistency(self) -> "WidgetConfig":

        if self.chart_type == "kpi":
            return self
    
        group_by = self.group_by
        agg_func = self.agg_func
        value_col = self.value_col

        # No aggregation requested
        if group_by is None and agg_func is None and value_col is None:
            return self

        # All three must be present
        if not (group_by and agg_func and value_col):
            raise ValueError("group_by, agg_func, and value_col must all be provided together")
        if not isinstance(group_by, list) or len(group_by) == 0:
            raise ValueError("group_by must be a non‑empty list when aggregation is requested")
        return self

    model_config = {
        "extra": "forbid",
        "str_strip_whitespace": True,
    }

# ------------------------------------------------------------------
# API request / response models for dashboard CRUD
# ------------------------------------------------------------------

# Dashboard creation – can include initial widgets
class DashboardCreateRequest(BaseModel):
    title: str
    widgets: Optional[List[WidgetConfig]] = None   # optional initial widgets

class DashboardUpdateRequest(BaseModel):
    title: Optional[str] = None

# Widget creation/update
class WidgetCreateRequest(BaseModel):
    config: WidgetConfig
    position: Optional[Dict[str, Any]] = None

class WidgetUpdateRequest(BaseModel):
    config: Optional[WidgetConfig] = None
    position: Optional[Dict[str, Any]] = None

# Response models
class WidgetResponse(BaseModel):
    id: int
    config: WidgetConfig
    chart_data: List[Dict[str, Any]]   # result of pipeline for this widget
    position: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str

class DashboardResponse(BaseModel):
    id: int
    title: str
    widgets: List[WidgetResponse]
    created_at: str
    updated_at: str

class DashboardListItem(BaseModel):
    id: int
    title: str
    created_at: str
    widget_count: int