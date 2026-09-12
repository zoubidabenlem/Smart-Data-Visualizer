from typing import Any, Dict, Optional, List, Literal
from numpy import number
from numpy import number
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import null
from app.schemas.pipeline import ModelFilterCondition, MissingConfig
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
    aggregation: Literal["SUM", "MEAN", "COUNT", "MIN", "MAX"]
    alias: Optional[str] = None   # required when >1 measure

class OrderByClause(BaseModel):
    field: str        
    alias: str
    direction: Literal["asc", "desc"] = "asc"

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
    filters: List[ModelFilterCondition] = Field(default_factory=list)
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

# ------------------------------------------------------------
# Widget position update (used for PATCH /position)
# ------------------------------------------------------------
class WidgetPositionUpdate(BaseModel):
    x: int
    y: int
    cols: int
    rows: int


#------------------------------------------------------------
# Page schemas for dashboard pages 
#------------------------------------------------------------
class DashboardPageMeta(BaseModel):
    id: int
    title: str
    order: int


class DashboardPageCreateRequest(BaseModel):
    title: str = "New Page"


class DashboardPageUpdateRequest(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None

# ------------------------------------------------------------
# API request / response models for dashboard CRUD
# ------------------------------------------------------------

# Dashboard creation – can include initial widgets
class DashboardCreateRequest(BaseModel):
    title: str
    widgets: Optional[List[WidgetConfig]] = None   # optional initial widgets

class DashboardUpdateRequest(BaseModel):
    title: Optional[str] = None

# ─── Modify WidgetCreateRequest ───
class WidgetCreateRequest(BaseModel):
    config: WidgetConfig
    position: Optional[WidgetPosition] = None
    page_id: Optional[int] = None   # NEW — defaults to first page if omitted

class WidgetUpdateRequest(BaseModel):
    config: Optional[WidgetConfig] = None
    position: Optional[WidgetPosition] = None

# Response models
class WidgetResponse(BaseModel):
    id: int
    page_id: Optional[int] = None   # NEW
    config: WidgetConfig
    chart_data: List[Dict[str, Any]]
    position: Optional[WidgetPosition] = None
    created_at: str
    updated_at: str
    
class DashboardResponse(BaseModel):
    id: int
    title: str
    pages: List[DashboardPageMeta] = Field(default_factory=list)   # NEW
    widgets: List[WidgetResponse]
    created_at: str
    updated_at: str

class DashboardListItem(BaseModel):
    id: int
    title: str
    created_at: str
    widget_count: int

class DashboardPaginatedResponse(BaseModel):
    items: List[DashboardListItem]
    total: int
    page: int
    size: int
    pages: int