from sqlalchemy import Column,Boolean, Integer, String, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum

class SourceType(str, enum.Enum):
    csv = "csv"
    excel = "excel"
    mysql = "mysql"

class Dataset(Base):
    __tablename__ = 'datasets'

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename      = Column(String(255), nullable=False)
    source_type   = Column(Enum(SourceType), nullable=False)  # csv/excel/mysql
    uploaded_at   = Column(DateTime, server_default=func.now())
    row_count     = Column(Integer, nullable=True)
    col_count     = Column(Integer, nullable=True)
    column_schema = Column(JSON, nullable=True)
    # column_schema stores: [{"name": "revenue", "dtype": "float64"}, ...]
    # This is what the Angular Builder reads to populate column pickers
    #refine step 
    source_path = Column(String(1024), nullable=False)
    is_refined = Column(Boolean, default=False)
    refined_column_schema = Column(JSON, nullable=True)
    # Relationships
    owner      = relationship("User", back_populates="datasets")
    dashboards = relationship("DashboardConfig", back_populates="dataset")