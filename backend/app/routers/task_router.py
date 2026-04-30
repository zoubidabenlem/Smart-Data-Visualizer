from fastapi import APIRouter, HTTPException
from app.services.task_manager import get_task_status, task_cache
from app.core.cache import prepared_cache

router = APIRouter(prefix="/prepare", tags=["Prepare Tasks"])

@router.get("/status/{task_id}")
async def get_task_result(task_id: str):
    meta = get_task_status(task_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Task not found or expired")

    status = meta["status"]
    if status == "pending" or status == "processing":
        return {"status": status}

    if status == "completed":
        cache_key = meta["cache_key"]
        # Fetch the actual chart data from the long‑lived prepared cache
        chart_data = prepared_cache.get(cache_key)
        if chart_data is None:
            raise HTTPException(status_code=410, detail="Result cache expired")
        return {
            "status": "completed",
            "result": chart_data,
        }

    # failed
    return {"status": "failed", "error": meta["error"]}