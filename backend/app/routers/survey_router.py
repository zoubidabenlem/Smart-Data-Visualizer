from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin
from app.models.survey import SurveyRequest
from app.schemas.survey_schemas import SurveyCreate, SurveyOut

router = APIRouter(prefix="/survey", tags=["Survey"])

@router.post(
    "/submit",
    response_model=SurveyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Public endpoint – submit an interest survey"
)
def submit_survey(body: SurveyCreate, db: Session = Depends(get_db)):
    """
    Anyone (unauthenticated) can submit a survey.
    """
    new_req = SurveyRequest(
        business_email=body.business_email,
        contact_name=body.contact_name,
        company_name=body.company_name,
        data_description=body.data_description,
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req


@router.get(
    "/requests",
    response_model=List[SurveyOut],
    summary="Admin only – list all survey requests",
    dependencies=[Depends(require_admin)]   # JWT guard
)
def list_requests(db: Session = Depends(get_db)):
    return db.query(SurveyRequest).order_by(SurveyRequest.created_at.desc()).all()