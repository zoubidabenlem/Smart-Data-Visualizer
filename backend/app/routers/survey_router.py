from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin
from app.models.survey import SurveyRequest
from app.schemas.survey_schemas import SurveyCreate, SurveyOut, SurveyStatusUpdate

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

# ---- Endpoint ----
@router.patch(
    "/requests/{request_id}/status",
    response_model=SurveyOut,
    summary="Admin only – update survey request status",
    dependencies=[Depends(require_admin)]
)
def update_survey_status(
    request_id: int,
    body: SurveyStatusUpdate,
    db: Session = Depends(get_db)
):
    # Validate status
    allowed = ["pending", "reviewed"]
    if body.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Status must be one of: {', '.join(allowed)}"
        )

    req = db.query(SurveyRequest).filter(SurveyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Survey request not found")

    req.status = body.status
    db.commit()
    db.refresh(req)
    return req