from fastapi import FastAPI
from app.db.init_db import init_db
app = FastAPI(title="Smart Data Visualizer API")

@app.get("/")
def root():
    return {"message": "API is running"}



@app.on_event("startup")
def on_startup():
    init_db()  # runs once when server starts