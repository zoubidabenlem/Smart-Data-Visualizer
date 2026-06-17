from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path                
from app.db.init_db import init_db
from app.routers import auth_router as auth_router
from app.routers import dataset_router as dataset_router
from app.routers import task_router as task_router
from app.routers import dashboard_router as dashboard_router
#Exception handlers
from app.core.exception_handlers import (
    pydantic_validation_handler,
    value_error_handler,
    pipeline_validation_handler,
    file_not_found_handler,
    unhandled_exception_handler,
)
#validation error
from pydantic import ValidationError
from app.services.pipeline.validation import PipelineValidationError
from app.core.logging_middleware import LoggingMiddleware
from app.routers import user_router

app = FastAPI(
    title="Smart Data Visualizer API",
    version="1.0.0",
    description="Lightweight BI MVP — FastAPI · Pandas · MySQL · JWT",
)
app.add_middleware(LoggingMiddleware)

# ── CORS (adjust origins for production) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------- Exception Handlers (Phase 4 Task 3) ----------
app.add_exception_handler(ValidationError, pydantic_validation_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(PipelineValidationError, pipeline_validation_handler)
app.add_exception_handler(FileNotFoundError, file_not_found_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
# -----------------------------------------------------------

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)

# (Phase 2+) Add datasetrouters here
app.include_router(dataset_router.router)
# (Phase 3) user management router (admin-only)
app.include_router(user_router.router)  # Admin-only user management endpoints
#app.include_router(mysql_router.router)
app.include_router(task_router.router)
 # PHASE 4 dashboard router
app.include_router(dashboard_router.router) 

@app.get("/", tags=["Health"])
def root():
    return {"message": "Smart Data Visualizer API is running", "version": "1.0.0"}


@app.on_event("startup")
def on_startup():
    Path("./uploads").mkdir(exist_ok=True)   
    init_db()
