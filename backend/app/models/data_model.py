from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from sqlalchemy.sql import func

class DataModel(Base):
    __tablename__ = "data_models"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(1024), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    base_dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)

    owner = relationship("User", back_populates="data_models")
    base_dataset = relationship("Dataset", foreign_keys=[base_dataset_id])
    datasets = relationship("ModelDataset", back_populates="model", cascade="all, delete-orphan")
    relationships = relationship("TableRelationship", back_populates="model", cascade="all, delete-orphan")
    widgets = relationship("Widget", back_populates="model")

class ModelDataset(Base):
    __tablename__ = "model_datasets"

    model_id = Column(Integer, ForeignKey("data_models.id", ondelete="CASCADE"), primary_key=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), primary_key=True)
    alias = Column(String(64), nullable=True)   # user-friendly table alias

    model = relationship("DataModel", back_populates="datasets")
    dataset = relationship("Dataset", back_populates="model_links")