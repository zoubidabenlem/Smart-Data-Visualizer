from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class SurveyCreate(BaseModel):
    business_email: EmailStr
    contact_name: Optional[str] = None
    company_name: Optional[str] = None
    data_description: str          # no max length for now

class SurveyOut(BaseModel):
    id: int
    business_email: EmailStr
    contact_name: Optional[str]
    company_name: Optional[str]
    data_description: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True