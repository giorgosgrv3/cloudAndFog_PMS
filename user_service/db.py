import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base # <--- declarative_base is crucial

DB_URI = os.getenv("DB_URI", "mysql+pymysql://root:rootpw@mysql:3306/users_db")

engine = create_engine(DB_URI, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# Το Base χρειάζεται για τα models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()