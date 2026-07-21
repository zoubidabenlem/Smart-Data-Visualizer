# test_mysql_connection.py
import sys
sys.path.insert(0, '.')

from app.db.base import SessionLocal
from app.models.mysql_connection import MySQLConnection
from app.services.mysql_connection_service import MySQLConnectionService

db = SessionLocal()
try:
    conn = db.query(MySQLConnection).first()
    if not conn:
        print("No connection found in DB.")
        sys.exit(1)
    print(f"Testing connection {conn.id}: host={conn.host}, port={conn.port}, db={conn.database}, user={conn.username}")
    MySQLConnectionService.test_connection(conn)
    print("SUCCESS: connection OK")
except Exception as e:
    print(f"FAILED: {e}")
finally:
    db.close()