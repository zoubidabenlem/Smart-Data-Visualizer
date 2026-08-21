from app.routers.models.crud import router as crud_router
from app.routers.models.datasets import router as datasets_router
from app.routers.models.relationships import router as relationships_router
from app.routers.models import prepare as model_prepare

from fastapi import APIRouter
router = APIRouter()
router.include_router(crud_router)
router.include_router(datasets_router)
router.include_router(relationships_router)
router.include_router(model_prepare.router)