from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

# ---------- Connection schemas ----------
class MySQLConnectionCreate(BaseModel):
    name: str
    host: str
    port: int = 3306
    database: str
    username: str
    password: str

class MySQLConnectionUpdate(BaseModel):
    name: Optional[str]
    host: Optional[str]
    port: Optional[int]
    database: Optional[str]
    username: Optional[str]
    password: Optional[str]

class MySQLConnectionOut(BaseModel):
    id: int
    user_id: int
    name: str
    host: str
    port: int
    database: str
    username: str
    # Never return the password (encrypted or not)
    created_at: datetime

    class Config:
        orm_mode = True

# ---------- Table exploration schemas ----------
class TableListResponse(BaseModel):
    tables: List[str]

class TableSchemaResponse(BaseModel):
    columns: List[dict]   # [{"name": "...", "dtype": "number"}, ...]

class TablePreviewResponse(BaseModel):
    rows: List[dict]

class ImportMySQLRequest(BaseModel):
    connection_id: int
    table_name: str