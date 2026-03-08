from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.init_db import init_db
from app.routers import auth_router as auth_router

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

# (Phase 2+) Add dataset, mysql, dashboard routers here


@app.get("/", tags=["Health"])
def root():
    return {"message": "Smart Data Visualizer API is running", "version": "1.0.0"}


@app.on_event("startup")
def on_startup():
    init_db()
