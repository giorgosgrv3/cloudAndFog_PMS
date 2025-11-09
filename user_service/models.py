from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Boolean, Enum as SAEnum
from enum import StrEnum  # Python 3.11+

class Base(DeclarativeBase):
    pass

class Role(StrEnum):
    ADMIN = "admin"
    TEAM_LEADER = "team_leader"
    MEMBER = "member"

class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    email:    Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name:    Mapped[str] = mapped_column(String(64))
    last_name:     Mapped[str] = mapped_column(String(64))
    role:    Mapped[Role] = mapped_column(SAEnum(Role, name="role_enum"), default=Role.MEMBER, nullable=False)
    active:  Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
