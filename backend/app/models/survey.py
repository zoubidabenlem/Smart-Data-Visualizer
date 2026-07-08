from sqlalchemy import Column, Integer, String, Text, DateTime, Enum
from sqlalchemy.sql import func
import enum

from app.models.base import Base

class SurveyStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    contacted = "contacted"

class SurveyRequest(Base):
    __tablename__ = "survey_requests"

    id = Column(Integer, primary_key=True, index=True)
    business_email = Column(String(180), nullable=False, index=True)
    contact_name = Column(String(120), nullable=True)           # optional
    company_name = Column(String(180), nullable=True)
    data_description = Column(Text, nullable=False)             # short description
    status = Column(
        Enum(SurveyStatus),
        default=SurveyStatus.pending,
        nullable=False
    )
    created_at = Column(DateTime, server_default=func.now())