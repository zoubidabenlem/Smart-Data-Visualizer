from sqlalchemy import Column,Boolean, Integer, String, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.models.mysql_connection import MySQLConnection
import enum

class SourceType(str, enum.Enum):
    csv = "csv"
    excel = "excel"
    mysql = "mysql"

class DatasetStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    REFINING = "REFINING"
    REFINED = "REFINED"
    ERROR = "ERROR"

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
    #refine step 
    source_path = Column(String(1024), nullable=True)
    status = Column(Enum(DatasetStatus), nullable=False, default=DatasetStatus.UPLOADED)
    refined_column_schema = Column(JSON, nullable=True)
    header_row = Column(Integer, nullable=False, default=0)   # 0‑based row index of the header
    skip_rows = Column(JSON, nullable=True)                    # list of ints (rows skipped before header)
    custom_column_names = Column(JSON, nullable=True)  
     # dict mapping original -> new name (optional)
    @property
    def is_refined(self):
        return self.status == DatasetStatus.REFINED
    connection_id = Column(Integer, ForeignKey("mysql_connections.id"), nullable=True)
    source_table = Column(String(255), nullable=True)   # the table/view name we imported

    # Relationships
    owner      = relationship("User", back_populates="datasets")
    connection = relationship("MySQLConnection", back_populates="datasets")
    model_links = relationship("ModelDataset", back_populates="dataset",cascade="all, delete-orphan",passive_deletes=True)     # optional; relies on DB-level cascade if you want


