
from app.models.base import Base, engine, get_db
from app.models.role import Role
from app.models.user import User
from app.models.dataset import Dataset, SourceType
from app.models.dashboard import DashboardConfig, ChartType
from app.models.cache_entry import CacheEntry

'''
SQLAlchemy's Base.metadata.create_all() only creates tables
 for models it has seen imported. 
 If a model isn't imported here, its table won't be created.
'''