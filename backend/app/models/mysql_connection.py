from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class MySQLConnection(Base):
    __tablename__ = "mysql_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)            # friendly label
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=3306)
    database = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)      # Fernet‑encrypted

    created_at = Column(DateTime, server_default=func.now())

    # Relations
    owner = relationship("User", back_populates="mysql_connections")
    datasets = relationship("Dataset", back_populates="connection")