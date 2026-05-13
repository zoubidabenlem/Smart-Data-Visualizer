# backend/app/core/exception_handlers.py
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from app.services.pipeline.validation import PipelineValidationError


async def pydantic_validation_handler(request: Request, exc: ValidationError):
    """Catch Pydantic ValidationError -> 422 with field-level details."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": list(error.get("loc", [])),
            "msg": error.get("msg", "")
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors}
    )


async def value_error_handler(request: Request, exc: ValueError):
    """Catch simple ValueError (e.g. from custom validators) -> 422."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)}
    )


async def pipeline_validation_handler(request: Request, exc: PipelineValidationError):
    """Catch structured pipeline validation errors -> 422."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors}
    )


async def file_not_found_handler(request: Request, exc: FileNotFoundError):
    """Missing dataset file -> 400 with clear message."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "Dataset file unavailable. Please re-upload the file."}
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    """All other unhandled errors -> 500, no stack trace exposed."""
    logging.exception("Unhandled exception")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )