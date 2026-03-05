from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    email           = Column(String(180), unique=True, nullable=False, index=True)
    password_hash   = Column(String(255), nullable=False)   # bcrypt 
    role_id         = Column(Integer, ForeignKey("roles.id"), nullable=False)
    created_at      = Column(DateTime, server_default=func.now())
    is_active       = Column(Boolean, default=True)          # soft disable

    # Relationships
    role        = relationship("Role", back_populates="users")
    datasets    = relationship("Dataset", back_populates="owner")
    dashboards  = relationship("DashboardConfig", back_populates="owner")