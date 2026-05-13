# backend/app/core/logging_middleware.py
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.dependencies.auth_dependencies import get_current_user_optional

logger = logging.getLogger("request_logger")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Extract user safely (returns None if not authenticated)
        user = await get_current_user_optional(request)
        email = user.email if user else None
        
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        # Build log message
        user_part = f"user={email} | " if email else ""
        logger.info(
            f"{request.method} {request.url.path} | "
            f"{user_part}"
            f"status={response.status_code} | "
            f"time={process_time:.2f}ms"
        )
        return response