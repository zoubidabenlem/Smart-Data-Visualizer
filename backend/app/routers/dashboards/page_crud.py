# app/routers/dashboards/page_crud.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth_dependencies import require_admin
from app.db.base import get_db
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardPage
from app.schemas.dashboard_schemas import (
    DashboardPageMeta,
    DashboardPageCreateRequest,
    DashboardPageUpdateRequest,
)
from app.core.cache import invalidate_cache
from app.core.logging_config import logger

router = APIRouter()


def _get_owned_dashboard(db: Session, dashboard_id: int, current_user: User) -> Dashboard:
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash or dash.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dash


@router.post("/{dashboard_id}/pages", response_model=DashboardPageMeta, status_code=201)
def create_page(
    dashboard_id: int,
    payload: DashboardPageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = _get_owned_dashboard(db, dashboard_id, current_user)
    next_order = max((p.order for p in dash.pages), default=-1) + 1
    page = DashboardPage(
        dashboard_id=dash.id,
        title=payload.title or f"Page {next_order + 1}",
        order=next_order,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    invalidate_cache(f"dashboard_response:{dashboard_id}")
    return DashboardPageMeta(id=page.id, title=page.title, order=page.order)


@router.patch("/{dashboard_id}/pages/{page_id}", response_model=DashboardPageMeta)
def update_page(
    dashboard_id: int,
    page_id: int,
    payload: DashboardPageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = _get_owned_dashboard(db, dashboard_id, current_user)
    page = (
        db.query(DashboardPage)
        .filter(DashboardPage.id == page_id, DashboardPage.dashboard_id == dash.id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    if payload.title is not None:
        page.title = payload.title
    if payload.order is not None:
        page.order = payload.order

    db.commit()
    db.refresh(page)
    invalidate_cache(f"dashboard_response:{dashboard_id}")
    return DashboardPageMeta(id=page.id, title=page.title, order=page.order)


@router.delete("/{dashboard_id}/pages/{page_id}", status_code=204)
def delete_page(
    dashboard_id: int,
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    dash = _get_owned_dashboard(db, dashboard_id, current_user)
    page = (
        db.query(DashboardPage)
        .filter(DashboardPage.id == page_id, DashboardPage.dashboard_id == dash.id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Refuse to delete the last page
    if len(dash.pages) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last page")

    db.delete(page)   # cascade deletes widgets
    db.commit()
    invalidate_cache(f"dashboard_response:{dashboard_id}")
    return None