from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import ValidationError
import os, httpx # Add httpx
from typing import Annotated 
from db import get_database # <--- ADD THIS LINE

from motor.motor_asyncio import AsyncIOMotorClient # <-- (or similar line for motor)
from motor.motor_asyncio import AsyncIOMotorDatabase # <--- ADD THIS LINE
from schemas import TokenData, Role, TaskCreate # Import TaskCreate
from models import Task, PyObjectId # You'll need to import this once you write the model

# --- Settings (MUST be the same as user_service) ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

bearer_scheme = HTTPBearer()
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> TokenData:
    # Standard decoding logic (copied from team service)
    # ... (omitted for brevity, assume standard decoding and token attachment logic)
    # Note: You must adapt your final security.py file from the team_service/security.py file provided earlier
    # to include the necessary logic to decode the token.
    # ... (This function must decode the token and return TokenData)
    # -------------------------------------------------------------------------------------------------
    
    # Placeholder for security.py logic based on previous successful implementation:
    if SECRET_KEY is None:
        raise Exception("SECRET_KEY not set in environment")
        
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenData(
            username=payload.get("sub"), 
            role=payload.get("role"),
            token=token.credentials
        )
        if token_data.username is None or token_data.role is None:
            raise credentials_exception
            
    except (JWTError, ValidationError):
        raise credentials_exception

    return token_data
# -------------------------------------------------------------------------------------------------

async def get_validated_team_leader(
    task_data: TaskCreate, # Get the data from the request body
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> str: # Returns the validated team_id
    
    team_id = task_data.team_id
    
    # 1. Check if the user is a Team Leader
    if current_user.role != Role.TEAM_LEADER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Team Leaders are authorized to create tasks."
        )

    # 2. Check if the user is the leader of the specific team_id
    team_service_url = f"http://team_service:8002/teams/{team_id}"
    
    try:
        async with httpx.AsyncClient() as client:
            # We use the current user's token (which is already a Leader token)
            headers = {"Authorization": f"Bearer {current_user.token}"}
            response = await client.get(team_service_url, headers=headers)
        
        # If the user is NOT the leader of this team, team_service returns 403
        if response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="You can only create tasks for the team you lead."
            )
        
        # Team not found (404) or service is down (e.g., 500)
        response.raise_for_status() 
        
    # 3. Handle errors from the team_service call (merging 403 and 404)
    except httpx.ConnectError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Team service is unreachable.")
    except Exception:
        # This catches 404 Not Found (Team ID doesn't exist)
        # This catches 403 Forbidden (User is not the leader of that team)
        # This catches 500 Internal Server Error (Something broke)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # <-- Use 400 for a bad request
            detail="Team assignment failed. The specified Team ID is invalid or inaccessible."
        )
    
    # 4. If all checks passed, the team_id is valid, and the user is the leader.
    return team_id


async def get_team_access_for_tasks(
    team_id: str,
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> str: # Returns the validated team_id
    """
    Checks with Team Service if the user is an Admin or a Member of the target team.
    If authorized, returns the team_id.
    """
    # Prepare for inter-service call
    team_service_url = f"http://team_service:8002/teams/{team_id}"
    
    try:
        async with httpx.AsyncClient() as client:
            # We must send the user's token so the Team Service can run its security check
            headers = {"Authorization": f"Bearer {current_user.token}"}
            response = await client.get(team_service_url, headers=headers)
        
        # Team service will return 403 Forbidden if the user is not a member
        if response.status_code == 403:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view tasks for this team."
            )
            
        # This catches 404 Not Found (Team ID doesn't exist) and 5xx errors
        response.raise_for_status() 
        
    except httpx.ConnectError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Team service is unreachable.")
    except Exception as e:
        # Merge 404 Not Found errors into 403 Forbidden
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The specified team was not found or is inaccessible."
        )
    
    return team_id # All checks passed, the user has access

# This is used for deletion. It checks if the user is the team leader of the team, to which
# the task belongs, and returns the task object. it is then deleted by the endpoint.

async def get_task_leader_only(
    task_id: str, # Get the ID from the path
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)]
) -> Task:
    """
    Dependency that checks if the user is the LEADER of the team
    the task belongs to.
    """
    # 1. Validate Task ID format
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # 2. Find the task in the database
    task_doc = await db["tasks"].find_one({"_id": obj_id})

    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    task = Task(**task_doc)

    # 3. Security Check (Role and Ownership)
    # Only allow if the user is a Team Leader AND their username matches the task creator's username
    if current_user.role == Role.TEAM_LEADER and current_user.username == task.created_by:
        return task # Success! Return the task object
    
    # Check if user is an Admin (Admin can delete any task)
    if current_user.role == Role.ADMIN:
        return task # Success!

    # 4. Fail if not authorized
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the Admin or the Task Creator/Team Leader can delete this task."
    )

async def authorize_comment_deletion(
    task_id: str,
    comment_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
) -> PyObjectId: # Returns the validated task ObjectId
    """
    Authorization check for comment deletion:
    Allowed if the user is the comment creator, the Team Leader of the task's team, or an Admin.
    """
    
    # 1. Validate IDs
    try:
        task_obj_id = PyObjectId(task_id)
        comment_obj_id = PyObjectId(comment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task or comment ID format.")

    # 2. Find the Task and Comment
    task_doc = await db["tasks"].find_one(
        {"_id": task_obj_id}, 
        projection={"team_id": 1, "comments": 1}
    )
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    comments = task_doc.get("comments", [])
    
    # Find the specific comment within the list
    target_comment = next((c for c in comments if c["_id"] == comment_obj_id), None)
    if not target_comment:
        raise HTTPException(status_code=404, detail="Comment not found.")

    # 3. Check Authorization Roles
    user_is_creator = current_user.username == target_comment.get("created_by")
    user_is_admin = current_user.role == Role.ADMIN
    user_is_leader = False
    
    # Check if the user is the Team Leader (Requires ISC call to Team Service)
    team_id = task_doc["team_id"]
    if current_user.role == Role.TEAM_LEADER:
        try:
            team_service_url = f"http://team_service:8002/teams/{team_id}/internal/is-leader/{current_user.username}"
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {current_user.token}"}
                response = await client.get(team_service_url, headers=headers)
            
            # Team Service returns 200 if the user is the leader of that team, 404/403 otherwise
            if response.status_code == 200 and response.json().get("is_leader"):
                user_is_leader = True
        except Exception:
            # Service error, assume not authorized for safety
            pass 

    # 4. Final Permission Check
    if not (user_is_creator or user_is_leader or user_is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be the comment creator, the Team Leader, or an Admin to delete this comment."
        )

    return task_obj_id # Return the validated Task ID for deletion