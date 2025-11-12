import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from functools import lru_cache

@lru_cache()
def get_mongo_uri():
    return os.getenv("MONGO_URI")

client: AsyncIOMotorClient = None

def get_database() -> AsyncIOMotorDatabase:
    global client
    if client is None:
        client = AsyncIOMotorClient(get_mongo_uri())
        
    # "pms_db" is the database name we defined in our .env
    return client["pms_db"]