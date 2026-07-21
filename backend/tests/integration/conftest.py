import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.core.config import Settings
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.role import Role
from main import app
from app.db.base import get_db

# Override app's database URL to point to test container
os.environ["DB_HOST"] = "localhost"
os.environ["MYSQL_PORT"] = "3307"
os.environ["MYSQL_USER"] = "root"
os.environ["MYSQL_PASSWORD"] = "test_root_pass"
os.environ["MYSQL_DATABASE"] = "app_test"

# Now import settings – they will read the overridden env vars
from app.core.config import settings

# Engine for app's own tables
engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=engine)

# Source database connection details (same host, different db)
SOURCE_DB = "source_test"
SOURCE_USER = "root"
SOURCE_PASS = "test_root_pass"
SOURCE_HOST = "localhost"
SOURCE_PORT = 3307  # inside Docker it's 3306, but mapped to 3307 on host; container sees 3306

import socket
def is_mysql_reachable(host, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect((host, port))
        return True
    except:
        return False

assert is_mysql_reachable("localhost", 3307), "Test MySQL container not running!"

@pytest.fixture(scope="session", autouse=True)
def setup_databases():
    # Create both databases if they don't exist (connect without db)
    root_engine = create_engine(f"mysql+pymysql://root:test_root_pass@localhost:3307")
    with root_engine.connect() as conn:
        conn.execute(text("CREATE DATABASE IF NOT EXISTS app_test"))
        conn.execute(text("CREATE DATABASE IF NOT EXISTS source_test"))
    root_engine.dispose()

    # Create app tables
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()

@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers(db_session):
    # Create admin role and user
    role = db_session.query(Role).filter_by(name="admin").first()
    if not role:
        role = Role(name="admin", permissions_json={})
        db_session.add(role)
        db_session.commit()

    user = User(
        email="admin@test.com",
        password_hash=hash_password("admin123"),
        role_id=role.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(data={"user_id": user.id, "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def source_db_setup():
    """Populate the source_test database with a sample table."""
    src_engine = create_engine(f"mysql+pymysql://{SOURCE_USER}:{SOURCE_PASS}@{SOURCE_HOST}:{SOURCE_PORT}/{SOURCE_DB}")
    with src_engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product VARCHAR(100),
                amount DECIMAL(10,2),
                sale_date DATE
            )
        """))
        conn.execute(text("""
            INSERT INTO sales (product, amount, sale_date) VALUES
            ('Widget', 19.99, '2025-01-01'),
            ('Gadget', 29.99, '2025-01-02'),
            ('Widget', 22.50, '2025-01-03')
        """))
        conn.commit()
    yield
    # Clean up after tests
    with src_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sales"))
    src_engine.dispose()