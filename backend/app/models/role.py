from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base

class Role(Base):
    __tablename__ = 'roles'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50),unique=True, nullable=False)
    permissions_json = Column(JSON, nullable=False) #for adding granular permissions late

    users = relationship("User", back_populates="role")