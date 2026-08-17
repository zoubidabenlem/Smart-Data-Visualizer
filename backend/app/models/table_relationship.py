import enum
from sqlalchemy.orm import relationship

import enum
from app.db.base import Base
from sqlalchemy import Column, Integer, String, Enum, ForeignKey


class JoinType(str, enum.Enum):
    INNER = "INNER"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    FULL = "FULL"

class Cardinality(str, enum.Enum):
    one_to_one = "one_to_one"
    one_to_many = "one_to_many"
    many_to_one = "many_to_one"
    many_to_many = "many_to_many"

class TableRelationship(Base):
    __tablename__ = "table_relationships"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("data_models.id", ondelete="CASCADE"), nullable=False)
    left_dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    right_dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    left_column = Column(String(255), nullable=False)
    right_column = Column(String(255), nullable=False)
    join_type = Column(Enum(JoinType), nullable=False, default=JoinType.INNER)
    cardinality = Column(Enum(Cardinality), nullable=False, default=Cardinality.many_to_one)
    description = Column(String(1024), nullable=True)   # or Text

    model = relationship("DataModel", back_populates="relationships")
    left_dataset = relationship("Dataset", foreign_keys=[left_dataset_id])
    right_dataset = relationship("Dataset", foreign_keys=[right_dataset_id])