from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from app.models.base import Base

class CacheEntry(Base):
    __tablename__ = "cache_entries"

    cache_key   = Column(String(512), primary_key=True)
    # key = f"{dataset_id}:{params_hash}" — matches your cachetools key
    result_json = Column(Text, nullable=False)   # serialized Pandas output
    created_at  = Column(DateTime, server_default=func.now())
    expires_at  = Column(DateTime, nullable=False)

'''
primary caching is in-memory via cachetools. 
This table is a fallback/persistence layer 
 useful if the server restarts
  and you want to avoid re-running expensive pipelines. 
  For MVP, we can skip this and only use cachetools.
'''