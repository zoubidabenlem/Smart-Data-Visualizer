import json
from typing import Any, Optional
import redis
from app.core.config import settings

# Optional faster JSON
try:
    import orjson
    def _dumps(obj: Any) -> str:
        return orjson.dumps(obj, default=str).decode('utf-8')
    def _loads(s: str) -> Any:
        return orjson.loads(s)
except ImportError:
    import json as std_json
    def _dumps(obj: Any) -> str:
        return std_json.dumps(obj, default=str)
    def _loads(s: str) -> Any:
        return std_json.loads(s)

# Synchronous Redis client (matches the sync nature of your routers)
_redis_client: Optional[redis.Redis] = None

def _get_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _redis_client

def set_cache(key: str, value: Any, ttl: Optional[int] = None) -> None:
    client = _get_client()
    serialised = _dumps(value)
    client.set(key, serialised, ex=ttl)

def get_cache(key: str) -> Optional[Any]:
    client = _get_client()
    data = client.get(key)
    if data is None:
        return None
    return _loads(data)

def delete_cache(key: str) -> None:
    client = _get_client()
    client.delete(key)

def exists_cache(key: str) -> bool:
    client = _get_client()
    return client.exists(key) > 0

def ping_redis() -> bool:
    try:
        client = _get_client()
        return client.ping()
    except Exception:
        return False