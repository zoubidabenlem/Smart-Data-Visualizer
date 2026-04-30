import asyncio
import uuid
from typing import Any, Dict, Optional
from cachetools import TTLCache
from app.core.logging_config import logger

# Task cache: stores task metadata
task_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)

# If Redis is available later (Task 7) this can be swapped transparently

async def create_task() -> str:
    """Generate a new task ID and init status."""
    task_id = str(uuid.uuid4())
    task_cache[task_id] = {
        "status": "pending",
        "cache_key": None,
        "error": None,
    }
    return task_id

def update_task_status(task_id: str, status: str, cache_key: Optional[str] = None, error: Optional[str] = None):
    """Update task metadata in cache."""
    if task_id in task_cache:
        task_cache[task_id] = {
            "status": status,
            "cache_key": cache_key,
            "error": error,
        }

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve task metadata."""
    return task_cache.get(task_id)

async def run_in_background(func, *args, task_id: str, **kwargs):
    """Wrapper that updates task status around an async function run in a thread."""
    try:
        update_task_status(task_id, "processing")
        # Offload the CPU-bound func to a thread
        result = await asyncio.to_thread(func, *args, **kwargs)
        update_task_status(task_id, "completed", cache_key=kwargs.get("cache_key"))
        return result
    except Exception as e:
        logger.exception(f"Task {task_id} failed: {e}")
        update_task_status(task_id, "failed", error=str(e))