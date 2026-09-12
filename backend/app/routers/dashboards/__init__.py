# app/routers/dashboards/router.py
from fastapi import APIRouter
from app.routers.dashboards.dashboard_crud import router as dashboard_crud_router
from app.routers.dashboards.widget_crud import router as widget_crud_router
from app.routers.dashboards.page_crud import router as page_crud_router

router = APIRouter(prefix="/dashboards", tags=["dashboards"])
router.include_router(dashboard_crud_router)
router.include_router(widget_crud_router)
router.include_router(page_crud_router)