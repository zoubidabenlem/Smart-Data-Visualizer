from typing import Any, Dict, Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.pipeline import FilterCondition, MissingConfig
from app.models.dashboard import WidgetPosition

ALLOWED_CHART_TYPES = {"bar", "line", "pie", "scatter", "area", "heatmap", "kpi"}

# ------------------------------------------------------------
# Reusable building blocks
# ------------------------------------------------------------
class ColumnRef(BaseModel):
    dataset_id: int
    column: str

class MeasureSpec(BaseModel):
    dataset_id: int
    column: str
    aggregation: Literal["SUM", "AVG", "COUNT", "MIN", "MAX"]
    alias: Optional[str] = None   # required when >1 measure

class OrderByClause(BaseModel):
    field: str                     # alias of a measure or dimension
    direction: Literal["asc", "desc"] = "asc"

# FilterCondition is imported from app.schemas.pipeline – make sure it has dataset_id
    
class WidgetPositionUpdate(BaseModel):
    widget_id: int
    position: Dict[str, Any]   # e.g., {"x": 0, "y": 0, "w": 4, "h": 3}

# ------------------------------------------------------------
# Main WidgetConfig
# ------------------------------------------------------------
class WidgetConfig(BaseModel):
    model_id: int
    chart_type: Literal["bar", "line", "pie", "scatter", "area", "heatmap", "kpi"]
    title: str

    # Multi‑table dimensions & measures
    dimensions: List[ColumnRef] = Field(default_factory=list)
    measures: List[MeasureSpec] = Field(default_factory=list)

    # Filters, sorting, row limit
    filters: List[FilterCondition] = Field(default_factory=list)
    order_by: List[OrderByClause] = Field(default_factory=list)
    limit: Optional[int] = None

    # Styling / misc
    color_scheme: str = "default"
    missing_config: Optional[MissingConfig] = None

    # ----- Structural validators (zero chart logic) -----
    @field_validator("chart_type")
    @classmethod
    def validate_chart_type(cls, v: str) -> str:
        if v not in ALLOWED_CHART_TYPES:
            raise ValueError(f"Invalid chart type: {v}. Allowed: {ALLOWED_CHART_TYPES}")
        return v

    @model_validator(mode="after")
    def check_measure_aliases(self):
        if len(self.measures) > 1:
            for i, m in enumerate(self.measures):
                if not m.alias:
                    raise ValueError(
                        f"Measure {i} (dataset {m.dataset_id}, col {m.column}) "
                        "must have an alias when multiple measures are used."
                    )
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


class DashboardPaginatedResponse(BaseModel):
    items: List[DashboardListItem]
    total: int
    page: int
    size: int
    pages: int