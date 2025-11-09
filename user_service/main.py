from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from routes import router as users_router
from models import Base
from db import engine

app = FastAPI(title="User Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.include_router(users_router)

@app.get("/health")
def health():
    # light DB ping; if MySQL is down this will raise
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
