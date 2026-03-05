from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

#engine to connect to mysql´
engine= create_engine(
    settings.DATABASE_URL,
    pool_size=5,
    pool_pre_ping=True, # to check if the connection is alive
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()