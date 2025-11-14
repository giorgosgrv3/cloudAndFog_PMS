from dotenv import load_dotenv
load_dotenv() # Load environment variables first

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router as tasks_router

app = FastAPI(title="Task Management API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(tasks_router)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

@app.get("/health")
def health():
    return {"service": "Task Management API", "status": "running"}