from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional
from bson import ObjectId

# --- Helper for MongoDB's _id ---
# MongoDB uses ObjectId for _id, which Pydantic doesn't
# understand by default. This helper fixes that.
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, *args, **kwargs):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema, *args, **kwargs):
        field_schema.update(type="string")

# --- Team Model ---
class Team(BaseModel):
    """
    The Team model as it is stored in the MongoDB database.
    """
    # This tells Pydantic to allow `id` as an alias for `_id`
    # and to use our PyObjectId helper for validation.
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str = Field(...)
    description: Optional[str] = None
    leader_id: str = Field(...) # We'll store the User's username (from the token)
    member_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True # Allows using _id
        arbitrary_types_allowed = True # Allows ObjectId
        json_encoders = {ObjectId: str} # How to serialize ObjectId to JSON