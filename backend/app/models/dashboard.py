from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum


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

