from typing import Any, Dict, Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.pipeline import AggregationSpec, FilterCondition, MissingConfig
from app.models.dashboard import WidgetPosition
from pydantic import BaseModel


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
    aggregations: Optional[List[AggregationSpec]]

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
        # KPI can have a single agg_func/value_col without group_by
        if self.chart_type == "kpi":
            # allow single aggregation with no group_by
            return self

        has_old_style = self.agg_func and self.value_col
        has_new_style = bool(self.aggregations)

        if has_old_style and has_new_style:
            raise ValueError("Use either 'aggregations' or 'agg_func'/'value_col', not both")

        if has_old_style:
            # Must also have group_by
            if not self.group_by or len(self.group_by) == 0:
                raise ValueError("group_by must be a non‑empty list when using agg_func and value_col")
            # Normalise into aggregations inside the router before creating PrepareRequest
            # (see step 4)

        if has_new_style and not self.group_by:
            # For charts, aggregation without group_by is allowed? Original rule required group_by.
            # If you want to allow global aggregation (e.g., total SUM) without group_by,
            # remove this check. Let's keep the old rule: group_by required for non-KPI.
            raise ValueError("group_by is required when aggregations are used for chart widgets")

        return self
    
    @model_validator(mode="after")
    def check_aliases(self):
        if self.aggregations and len(self.aggregations) > 1:
            for spec in self.aggregations:
                if not spec.alias:
                    raise ValueError("Alias is required when multiple aggregations are used")
        return self

    model_config = {
        "extra": "forbid",
        "str_strip_whitespace": True,
    }
class WidgetPositionUpdate(BaseModel):
    widget_id: int
    position: Dict[str, Any]   # e.g., {"x": 0, "y": 0, "w": 4, "h": 3}

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
    position: Optional[WidgetPosition] = None

class WidgetUpdateRequest(BaseModel):
    config: Optional[WidgetConfig] = None
    position: Optional[WidgetPosition] = None

# Response models
class WidgetResponse(BaseModel):
    id: int
    config: WidgetConfig
    chart_data: List[Dict[str, Any]]   # result of pipeline for this widget
    position: Optional[WidgetPosition] = None
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




class WidgetPositionUpdate(BaseModel):
    x: int
    y: int
    cols: int
    rows: int