import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from sqlalchemy.orm import Session

# Add these imports
from app.db.base import Base
from app.core.config import settings  # not needed, but we'll import engine from conftest later

from app.services.mysql_connection_service import MySQLConnectionService
from app.core.security import encrypt_password, create_access_token, hash_password
from app.models.user import User
from app.models.role import Role
from app.models.mysql_connection import MySQLConnection


@pytest.fixture(autouse=True)
def ensure_tables(db_session):
    """Ensure all tables are created before each test (idempotent)."""
    Base.metadata.create_all(bind=db_session.get_bind())
    yield


@pytest.fixture(autouse=True)
def mock_init_db():
    with patch("main.init_db", return_value=None):
        yield


@pytest.fixture
def client_and_db(db_session: Session):
    from app.db.base import get_db
    def override_get_db():
        yield db_session
    from main import app
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, db_session


def get_auth_headers(db_session: Session) -> dict:
    """Directly create a test user and return a valid Authorization header."""
    # Ensure a role exists with permissions_json
    role = db_session.query(Role).first()
    if not role:
        role = Role(name="admin", permissions_json={})
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

    # Create test user (only admin can register in your app, but here we bypass)
    user = User(
        email="test@test.com",
        password_hash=hash_password("secret123"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Token payload must contain "user_id" and "role" as your get_current_user expects
    token = create_access_token(data={"user_id": user.id, "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


def test_create_connection_success(client_and_db, mocker):
    client, db = client_and_db
    headers = get_auth_headers(db)

    # Mock the actual MySQL test_connection to avoid needing a real database
    mocker.patch.object(MySQLConnectionService, "test_connection", return_value={"status": "ok"})

    payload = {
        "name": "My DB",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "test",
        "username": "root",
        "password": "secret"
    }
    resp = client.post("/connections/mysql/", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My DB"
    assert "encrypted_password" not in data


def test_list_connections(client_and_db):
    client, db = client_and_db
    headers = get_auth_headers(db)

    # Retrieve the user we just created (same email)
    user = db.query(User).filter(User.email == "test@test.com").first()

    # Pre-create a connection owned by this user
    conn = MySQLConnection(
        user_id=user.id,
        name="Old DB",
        host="a",
        port=1,
        database="d",
        username="u",
        encrypted_password=encrypt_password("p")
    )
    db.add(conn)
    db.commit()

    resp = client.get("/connections/mysql/", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1