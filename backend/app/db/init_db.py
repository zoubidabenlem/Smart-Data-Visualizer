#create tables and seed roles
from app.models import Base, engine
from app.models.role import Role
from app.models.base import SessionLocal

def init_db():
    # Creates all tables if they don't exist (safe to run multiple times)
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")

    # Seed the two roles if they don't exist yet
    db = SessionLocal()
    try:
        if not db.query(Role).filter(Role.name == "admin").first():
            db.add(Role(name="admin", permissions_json={"can_create": True, "can_delete": True}))
        if not db.query(Role).filter(Role.name == "viewer").first():
            db.add(Role(name="viewer", permissions_json={"can_create": False, "can_delete": False}))
        db.commit()
        print("✅ Roles seeded")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()