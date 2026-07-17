from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.base import get_db
from app.dependencies.auth_dependencies import require_admin, get_current_user
from app.models.user import User
from app.models.mysql_connection import MySQLConnection
from app.models.dataset import Dataset
from app.schemas.mysql_connection_schemas import (
    MySQLConnectionCreate,
    MySQLConnectionOut,
    MySQLConnectionUpdate,
    TableListResponse,
    TableSchemaResponse,
    TablePreviewResponse,
    ImportMySQLRequest,
)
from app.services.mysql_connection_service import MySQLConnectionService
from app.schemas.dataset_schemas import DatasetOut
from app.core.security import encrypt_password

router = APIRouter(prefix="/connections/mysql", tags=["MySQL Connections"])

# ---------- CRUD for connections ----------
@router.post("/", response_model=MySQLConnectionOut, dependencies=[Depends(require_admin)])
def create_connection(
    payload: MySQLConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Optional: test connection before saving
    conn = MySQLConnection(
        user_id=current_user.id,
        name=payload.name,
        host=payload.host,
        port=payload.port,
        database=payload.database,
        username=payload.username,
        encrypted_password=encrypt_password(payload.password),  # encrypt before storing
    )
    # Test immediately
    MySQLConnectionService.test_connection(conn)
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn

@router.get("/", response_model=List[MySQLConnectionOut], dependencies=[Depends(require_admin)])
def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(MySQLConnection).filter(MySQLConnection.user_id == current_user.id).all()

@router.get("/{conn_id}", response_model=MySQLConnectionOut, dependencies=[Depends(require_admin)])
def get_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    return conn

@router.put("/{conn_id}", response_model=MySQLConnectionOut, dependencies=[Depends(require_admin)])
def update_connection(
    conn_id: int,
    payload: MySQLConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    for key, value in payload.dict(exclude_unset=True).items():
        if key == "password":
            conn.encrypted_password = encrypt_password(value)
        else:
            setattr(conn, key, value)
    db.commit()
    db.refresh(conn)
    return conn

@router.delete("/{conn_id}", status_code=200, dependencies=[Depends(require_admin)])
def delete_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    # Prevent deletion if datasets depend on it
    dataset_count = db.query(Dataset).filter(Dataset.connection_id == conn_id).count()
    if dataset_count > 0:
        raise HTTPException(400, "Cannot delete connection with existing datasets")
    db.delete(conn)
    db.commit()
    return {"message": "Connection deleted"}

# ---------- Test & explore ----------
@router.post("/{conn_id}/test", dependencies=[Depends(require_admin)])
def test_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    return MySQLConnectionService.test_connection(conn)

@router.get("/{conn_id}/tables", response_model=TableListResponse, dependencies=[Depends(require_admin)])
def list_tables(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    tables = MySQLConnectionService.list_tables(conn)
    return {"tables": tables}

@router.get("/{conn_id}/tables/{table_name}/schema", response_model=TableSchemaResponse, dependencies=[Depends(require_admin)])
def get_table_schema(
    conn_id: int,
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    schema = MySQLConnectionService.get_table_schema(conn, table_name)
    return {"columns": schema}

@router.get("/{conn_id}/tables/{table_name}/preview", response_model=TablePreviewResponse, dependencies=[Depends(require_admin)])
def get_table_preview(
    conn_id: int,
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == conn_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    data = MySQLConnectionService.get_preview(conn, table_name)
    return {"rows": data}

# ---------- Import as dataset ----------
@router.post("/import", response_model=DatasetOut, dependencies=[Depends(require_admin)])
def import_mysql_table(
    payload: ImportMySQLRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify connection exists and belongs to user
    conn = db.query(MySQLConnection).filter(
        MySQLConnection.id == payload.connection_id,
        MySQLConnection.user_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(404, "Connection not found")

    dataset = MySQLConnectionService.import_dataset(
        connection=conn,
        table_name=payload.table_name,
        current_user_id=current_user.id,
        db_session=db,
    )
    return DatasetOut.model_validate(dataset)