from dotenv import load_dotenv
load_dotenv() # This reads the root .env file


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router as teams_router

app = FastAPI(title="Team Management API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teams_router)

@app.get("/health")
def health():
    return {"service": "Team Management API", "status": "running"}