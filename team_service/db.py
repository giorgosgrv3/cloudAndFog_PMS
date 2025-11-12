import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from functools import lru_cache

# This is the single client for the entire application
# Motor handles connection pooling automatically.
client: AsyncIOMotorClient = None

@lru_cache() # Caches the env variable
def get_mongo_uri():
    return os.getenv("MONGO_URI")

def get_database() -> AsyncIOMotorDatabase:
    """
    This is the Dependency (the "Depends()") that our routes
    will use to get a database session.
    """
    global client
    if client is None:
        client = AsyncIOMotorClient(get_mongo_uri())
        
    # "pms_db" is the database name we defined in our .env
    return client["pms_db"]