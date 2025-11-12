from pydantic import BaseModel, Field
from typing import List, Optional
from enum import StrEnum
from datetime import datetime   

# --- We need to re-define the Role enum ---
# This service doesn't share memory with the user_service,
# so we must define the roles it needs to understand.
class Role(StrEnum):
    ADMIN = "admin"
    TEAM_LEADER = "team_leader"
    MEMBER = "member"

# --- Schema for data inside the JWT Token ---
class TokenData(BaseModel):
    username: str | None = None
    role: Role | None = None
    token: str | None = None # <-- ADD THIS LINE

# --- Schemas for Creating/Updating Teams ---
class TeamCreate(BaseModel):
    """
    Schema for creating a new team.
    """
    name: str = Field(..., min_length=3)
    description: Optional[str] = None
    leader_username: str # <-- ADD THIS LINE

class TeamUpdate(BaseModel):
    """
    Schema for updating a team's details.
    """
    name: Optional[str] = None
    description: Optional[str] = None

# --- Schemas for API Output ---
class TeamOut(BaseModel):
    """
    Schema for what we return from the API.
    """
    id: str # We'll return the ID as a string
    name: str
    description: Optional[str] = None
    leader_id: str
    member_ids: List[str]
    created_at: datetime

class MemberAdd(BaseModel):
    """
    Schema for adding a new member to a team.
    """
    username: str

class LeaderAssign(BaseModel):
    """
    Schema for re-assigning a team leader.
    """
    new_leader_username: str