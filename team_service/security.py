from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import ValidationError
import os
from motor.motor_asyncio import AsyncIOMotorDatabase # NEW IMPORT
from db import get_database # NEW IMPORT
from bson import ObjectId # NEW IMPORT
from models import Team # NEW IMPORT


# We import our local schema for TokenData
from schemas import TokenData, Role

# --- Settings (MUST be the same as user_service) ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256" 

bearer_scheme = HTTPBearer()

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

async def get_current_user(
    token: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> TokenData:
    """
    The new "get_current_user" for this microservice.
    It DOES NOT query a database.
    It simply decodes the token and trusts its contents.
    """
    if SECRET_KEY is None:
        raise Exception("SECRET_KEY not set in environment")
        
    try:
        # 1. Decode the token using the *shared* SECRET_KEY
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Get the data from the token payload
        token_data = TokenData(
            username=payload.get("sub"), 
            role=payload.get("role")
        )
        if token_data.username is None or token_data.role is None:
            raise credentials_exception
            
    except (JWTError, ValidationError):
        raise credentials_exception
    
    # --- ADD THIS LINE ---
    token_data.token = token.credentials # Attach the raw token

    # 3. Return the trusted data
    return token_data


async def get_current_admin_user(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """
    The Admin "gatekeeper". Checks the role from the token.
    """
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user does not have privileges to perform this action"
        )
    return current_user

async def get_team_leader_or_admin(
    team_id: str, # FastAPI will get this from the URL path
    current_user: TokenData = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Team: # It will return the team object if successful
    """
    Dependency that checks if a user is an ADMIN
    OR the 'leader_id' of the specific team.
    
    Returns the team document if authorized, otherwise raises 403/404.
    """
    try:
        obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    # Find the team in the database
    team_doc = await db["teams"].find_one({"_id": obj_id})
    
    if not team_doc:
        raise HTTPException(status_code=404, detail="Team not found")

    # Convert to Pydantic model
    team = Team(**team_doc)

    # --- The Core Security Logic ---
    if current_user.role == Role.ADMIN or team.leader_id == current_user.username:
        return team # Success! Return the team
    
    # If we get here, they are not the leader or an admin
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to modify this team."
    )

async def get_team_leader_only(
    team_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Team:
    """
    Dependency that checks if the user is the LEADER of the specific team.
    It explicitly blocks Admin users from using management functions.
    """
    # 1. Explicitly block Admin users (The new business rule)
    if current_user.role == Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot manage team members directly; this is a Team Leader function."
        )
    
    # 2. Check if the team ID is valid and find the team
    try:
        obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    team_doc = await db["teams"].find_one({"_id": obj_id})
    
    if not team_doc:
        raise HTTPException(status_code=404, detail="Team not found")

    team = Team(**team_doc)
    
    # 3. Final Check: Is the non-admin user the actual leader?
    if team.leader_id == current_user.username:
        return team # Success!
    
    # 4. Fail if not the leader
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to manage members for this team."
    )

# This is used during the task creation.
async def get_team_access_or_admin(
    team_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Team:
    """
    Dependency that checks if a user is an ADMIN OR a MEMBER of the specific team.
    Returns the team document if authorized.
    """
    # Ambiguous error used when the team is not found OR access is denied.
    ambiguous_error = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="The requested resource was not found or is inaccessible."
    )

    try:
        obj_id = ObjectId(team_id)
    except Exception:
        # Keep this technical error separate, as it's helpful for developers
        raise HTTPException(status_code=400, detail="Invalid team ID format") 

    team_doc = await db["teams"].find_one({"_id": obj_id})
    
    # 1. 404 SCENARIO: Team not found. We return the ambiguous error immediately.
    if not team_doc:
        raise ambiguous_error 

    team = Team(**team_doc)
    
    # 2. 403 SCENARIO: User is Admin OR user is a member
    if current_user.role == Role.ADMIN or current_user.username in team.member_ids:
        return team # Success!
    
    # 3. FINAL BLOCKING: If they are not Admin and not a member, block with the same ambiguous error.
    raise ambiguous_error