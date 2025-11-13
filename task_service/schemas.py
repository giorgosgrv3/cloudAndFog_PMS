from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from enum import StrEnum
from datetime import datetime # ADD THIS IMPORT

# --- NEW ENUMS ---
class TaskStatus(StrEnum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"

class TaskPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    URGENT = "URGENT"

# --- Enums and Token Schemas (Copied from Team Service) ---
class Role(StrEnum):
    ADMIN = "admin"
    TEAM_LEADER = "team_leader"
    MEMBER = "member"

class TokenData(BaseModel):
    username: str | None = None
    role: Role | None = None
    token: str | None = None

# --- Task Schemas ---
class TaskCreate(BaseModel):
    """
    Schema for creating a new task (The API Input)
    """
    team_id: str = Field(...)
    title: str = Field(..., min_length=5)
    description: Optional[str] = None
    assigned_to: str = Field(...)
    due_date: datetime = Field(...)
    # --- ENHANCED STATUS FIELD ---
    status: TaskStatus = Field(
        default=TaskStatus.TODO,
        # This description is used both in the docs and in error messages
        description=f"The current status of the task. Available states: {', '.join(TaskStatus)}"
    )
    
    # --- ENHANCED PRIORITY FIELD ---
    priority: TaskPriority = Field(
        ...,
        description=f"The priority level for the task. Available levels: {', '.join(TaskPriority)}"
    )


class TaskOut(BaseModel):
    """
    Schema for what is returned from the API (The Output)
    """
    id: str
    team_id: str
    title: str
    description: Optional[str] = None
    created_by: str
    assigned_to: str
    status: str
    priority: str
    due_date: datetime
    created_at: datetime
    # Comments are excluded in the list view for simplicity

# This is for TEAM LEADER or ADMIN, allows to change anything in the task
class TaskUpdate(BaseModel):
    """
    Schema for updating an existing task (all fields are optional).
    """
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[TaskStatus] = None # Uses the Enum
    priority: Optional[TaskPriority] = None # Uses the Enum
    due_date: Optional[datetime] = None

# This is for the ASSIGNED USER update, only allows state update to the task
class TaskStatusUpdate(BaseModel):
    """
    Schema for updating ONLY the task status.
    """
    status: TaskStatus

class CommentIn(BaseModel):
    """
    Schema for adding a new comment (API Input).
    """
    text: str = Field(..., min_length=2, max_length=1000)

class CommentOut(BaseModel):
    """
    Schema for viewing a comment (API Output).
    Note: The ID here is the nested object's ID (PyObjectId).
    """
    id: str
    text: str
    created_by: str
    created_at: datetime
    
    # Allows conversion from the MongoDB nested model
    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})