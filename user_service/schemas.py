from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from models import Role

class UserCreate(BaseModel):
    username:   str = Field(min_length=3, max_length=64)
    email:      EmailStr
    password:   str = Field(min_length=6, max_length=72)
    first_name: str = Field(min_length=1, max_length=64)
    last_name:  str = Field(min_length=1, max_length=64)

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    username:   str
    email:      EmailStr
    first_name: str
    last_name:  str
    role:       Role
    active:     bool

class Token(BaseModel):
    # schema for what we return to user after login
    access_token: str
    token_type: str

class TokenData(BaseModel):
    #schema for the data contained INSIDE the JWT
    username: str | None = None
    role: Role | None = None

class UserRoleUpdate(BaseModel):
    """
    Schema για την αλλαγή ρόλου ενός χρήστη.
    """
    role: Role # Δέχεται μόνο έγκυρες τιμές από το Enum (admin, team_leader, member)