from sqlalchemy import Column, Integer, String, Boolean, Enum as SAEnum
from db import Base
import enum

class Role(str, enum.Enum):
    ADMIN = "admin"
    TEAM_LEADER = "team_leader"
    MEMBER = "member"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    
    # Χρησιμοποιούμε SAEnum για ασφάλεια
    role = Column(SAEnum(Role), default=Role.MEMBER)
    active = Column(Boolean, default=False)