# app/services/sandbox_service.py

import json
from typing import List, Optional
from app.core.config import settings
from app.core.cache import RedisBackedCache  # assumed
from app.schemas.refine_schema import ColumnRefineAction

SANDBOX_KEY_PREFIX = "refine_sandbox:"

def _sandbox_key(dataset_id: int) -> str:
    return f"{SANDBOX_KEY_PREFIX}{dataset_id}"

def get_sandbox(dataset_id: int) -> List[ColumnRefineAction]:
    """Retrieve the current sandbox action list for a dataset."""
    cache = RedisBackedCache(ttl=settings.REFINE_SANDBOX_TTL)
    raw = cache.get(_sandbox_key(dataset_id))
    if raw is None:
        return []
    # raw is already deserialised by RedisBackedCache (which uses _loads)
    # raw should be a list of dicts
    return [ColumnRefineAction(**item) for item in raw]

def set_sandbox(dataset_id: int, actions: List[ColumnRefineAction]) -> None:
    """Save the sandbox action list. Automatically sets TTL."""
    cache = RedisBackedCache(ttl=settings.REFINE_SANDBOX_TTL)
    serialised = [act.dict() for act in actions]
    cache[_sandbox_key(dataset_id)] = serialised    # __setitem__ will call _redis_set

def clear_sandbox(dataset_id: int) -> None:
    """Remove sandbox for a dataset."""
    cache = RedisBackedCache(ttl=settings.REFINE_SANDBOX_TTL)
    del cache[_sandbox_key(dataset_id)]   # __delitem__ calls delete_cache