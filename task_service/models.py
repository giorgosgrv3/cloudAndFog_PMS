from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from schemas import TaskStatus, TaskPriority # <-- ADD THIS IMPORT

# --- Helper for MongoDB's _id ---
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

# --- Comment Entity ---
class Comment(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    text: str = Field(...)
    created_by: str = Field(...) # Username
    created_at: datetime = Field(default_factory=datetime.now)

class Attachment(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    filename: str = Field(...)        # Original filename
    content_type: str = Field(...)    # MIME type
    path: str = Field(...)            # Server-side path on disk
    uploaded_by: str = Field(...)     # Username of uploader
    uploaded_at: datetime = Field(default_factory=datetime.now)

# --- Task Entity ---
class Task(BaseModel):
    """
    Task model as stored in MongoDB.
    """
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    team_id: str = Field(...) # Reference to the team (we need to validate this exists)
    title: str = Field(...)
    description: Optional[str] = None
    created_by: str = Field(...) # The leader who created the task
    assigned_to: str = Field(...) # The member responsible for the task
    # --- CHANGED FIELDS ---
    status: TaskStatus = Field(default=TaskStatus.TODO) # USE ENUM
    priority: TaskPriority = Field(...) # USE ENUM
    due_date: datetime = Field(...)
    created_at: datetime = Field(default_factory=datetime.now)
    comments: List[Comment] = Field(default_factory=list)
    # NEW:
    attachments: List[Attachment] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}