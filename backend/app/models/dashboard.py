from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum

class ChartType(str, enum.Enum):
    bar     = "bar"
    line    = "line"
    pie     = "pie"
    scatter = "scatter"

class DashboardConfig(Base):
    __tablename__ = "dashboard_configs"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    dataset_id   = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    title        = Column(String(255), nullable=False)
    chart_type   = Column(Enum(ChartType), nullable=False)
    x_column     = Column(String(255), nullable=True)   # e.g. "month"
    y_column     = Column(String(255), nullable=True)   # e.g. "revenue"
    config_json  = Column(JSON, nullable=True)
    # config_json stores full config: filters, aggregation, display options
    # e.g. {"filters": [{"col":"sales","op":">","val":1000}], "agg": "SUM"}
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    owner   = relationship("User", back_populates="dashboards")
    dataset = relationship("Dataset", back_populates="dashboards")