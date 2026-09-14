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
# widget
class Widget(Base):
    __tablename__ = "dashboard_widgets"

    id           = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    page_id      = Column(
        Integer,
        ForeignKey("dashboard_pages.id", ondelete="CASCADE"),
        nullable=True,        # NOT NULL after migration backfill
        index=True,
    )
    model_id = Column(Integer, ForeignKey("data_models.id", ondelete="CASCADE"), nullable=False)    
    config_json  = Column(JSON, nullable=False)   # full widget config (chart_type, filters, etc.)
    position     = Column(JSON, nullable=True)    # e.g. {"x":0, "y":0, "w":6, "h":4}
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    dashboard = relationship("Dashboard", back_populates="widgets")
    page      = relationship("DashboardPage", back_populates="widgets")
    model = relationship("DataModel", back_populates="widgets")

#pages container for widgets 
class DashboardPage(Base):
    __tablename__ = "dashboard_pages"

    id           = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title        = Column(String(255), nullable=False, default="Page 1")
    order        = Column(Integer, nullable=False, default=0)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    dashboard = relationship("Dashboard", back_populates="pages")
    widgets   = relationship(
        "Widget",
        back_populates="page",
        cascade="all, delete-orphan",
    )

#container for dahsboard pages
class Dashboard(Base):
    __tablename__ = "dashboards"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    title        = Column(String(255), nullable=False)
    model_id     = Column(
        Integer,
        ForeignKey("data_models.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    owner   = relationship("User", back_populates="dashboards")
    model   = relationship("DataModel", foreign_keys=[model_id])
    pages   = relationship(
        "DashboardPage",
        back_populates="dashboard",
        cascade="all, delete-orphan",
        order_by="DashboardPage.order",
    )
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


