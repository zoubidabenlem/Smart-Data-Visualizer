from app.core.redis_client import set_cache as _redis_set, get_cache as _redis_get, delete_cache, exists_cache
from app.core.config import settings
from cachetools import TTLCache


# ----------------------------------------------------------------------
#  Redis‑backed dict for all JSON‑compatible data
# ----------------------------------------------------------------------
class RedisBackedCache:
    """Drop‑in replacement for a dict, backed by Redis."""
    def __init__(self, ttl: int = 300):
        self.ttl = ttl

    def __setitem__(self, key, value):
        _redis_set(key, value, self.ttl)

    def __getitem__(self, key):
        val = _redis_get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __contains__(self, key):
        return exists_cache(key)

    def get(self, key, default=None):
        val = _redis_get(key)
        return val if val is not None else default

    def __delitem__(self, key):
        delete_cache(key)


# ----------------------------------------------------------------------
#  Cache instances
# ----------------------------------------------------------------------
preview_cache         = RedisBackedCache(ttl=settings.cache_ttl_seconds)   # default 300s
prepared_cache        = RedisBackedCache(ttl=300)                         # chart data
dashboard_chart_cache = RedisBackedCache(ttl=300)                         # widget data
refined_cache         = RedisBackedCache(ttl=settings.cache_ttl_seconds)   # refined rows (JSON)

# DataFrame cache stays in local memory (not JSON‑serialisable)
refined_df_cache      = TTLCache(maxsize=100, ttl=600)                    # actual pd.DataFrames
dataset_df_cache      = TTLCache(maxsize=50, ttl=3600)   # general dataset DataFrame cache


# ----------------------------------------------------------------------
#  Cache‑key builders
# ----------------------------------------------------------------------
def preview_cache_key(dataset_id: int, is_refined: bool) -> str:
    """Generates a consistent key for the preview cache."""
    return f"preview:{dataset_id}:{int(is_refined)}"

def get_refined_cache_key(dataset_id: int) -> str:
    """Generates a key for the refined data cache."""
    return f"refined:{dataset_id}"

def get_prepared_cache_key(dataset_id: int, payload_dict: dict) -> str:
    """Generates a key for the prepared/chart data cache.
       Uses a hash of the payload to distinguish different pipeline requests."""
    import hashlib, json
    payload_hash = hashlib.md5(
        json.dumps(payload_dict, sort_keys=True, default=str).encode()
    ).hexdigest()
    return f"prepared:{dataset_id}:{payload_hash}"

# ----------------------------------------------------------------------
#  Backward‑compatible helper functions (used by routers)
# ----------------------------------------------------------------------
def get_cache(key):
    return _redis_get(key)

def set_cache(key, value, ttl=None):
    _redis_set(key, value, ttl)

def invalidate_cache(key):
    delete_cache(key)