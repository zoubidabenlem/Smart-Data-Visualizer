from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path                
from app.db.init_db import init_db
from app.routers import auth_router as auth_router
from app.routers import dataset_router as dataset_router
from app.routers import task_router as task_router
app = FastAPI(
    title="Smart Data Visualizer API",
    version="1.0.0",
    description="Lightweight BI MVP — FastAPI · Pandas · MySQL · JWT",
)

# ── CORS (adjust origins for production) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)

# (Phase 2+) Add datasetrouters here
app.include_router(dataset_router.router)
#app.include_router(mysql_router.router)
app.include_router(task_router.router)

@app.get("/", tags=["Health"])
def root():
    return {"message": "Smart Data Visualizer API is running", "version": "1.0.0"}


@app.on_event("startup")
def on_startup():
    Path("./uploads").mkdir(exist_ok=True)   
    init_db()
