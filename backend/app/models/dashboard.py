from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, JSON, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

from pydantic import BaseModel, model_validator


# Association table for many-to-many between users and dashboards
dashboard_assignment = Table(
    "dashboard_assignment",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id"), primary_key=True),
)

class Widget(Base):
    __tablename__ = "dashboard_widgets"

    id           = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    dataset_id   = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    config_json  = Column(JSON, nullable=False)   # full widget config (chart_type, filters, etc.)
    position     = Column(JSON, nullable=True)    # e.g. {"x":0, "y":0, "w":6, "h":4}
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    dashboard = relationship("Dashboard", back_populates="widgets")
    dataset   = relationship("Dataset", back_populates="widgets")  # add to Dataset model as well

#container for dahsboard widgets
class Dashboard(Base):
    __tablename__ = "dashboards"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    title        = Column(String(255), nullable=False)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    owner   = relationship("User", back_populates="dashboards")
    widgets = relationship("Widget",back_populates="dashboard", cascade="all, delete-orphan")
    assigned_users = relationship(
        "User",
        secondary=dashboard_assignment,
        back_populates="assigned_dashboards"
    )


class WidgetPosition(BaseModel):
    x: int = 0
    y: int = 0
    cols: int = 1
    rows: int = 1

    @model_validator(mode='before')
    @classmethod
    def normalize_old_keys(cls, values: dict) -> dict:
        # If the backend receives old `w` / `h`, map them to `cols` / `rows`
        if 'w' in values and 'cols' not in values:
            values['cols'] = values['w']
        if 'h' in values and 'rows' not in values:
            values['rows'] = values['h']
        return values


