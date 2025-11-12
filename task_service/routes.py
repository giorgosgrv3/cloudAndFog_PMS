from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, List, Optional # ADD THIS

from db import get_database
from schemas import TaskCreate, TaskOut, TokenData, TaskStatus, TaskUpdate, TaskStatusUpdate, Role
from models import Task, PyObjectId
from security import get_current_user, get_validated_team_leader, get_team_access_for_tasks, get_task_leader_only # Import the new dependency
import httpx

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate, 
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)], # For created_by
    # The security check runs first. If successful, it returns the validated team_id
    validated_team_id: Annotated[str, Depends(get_validated_team_leader)] 
):
    """
    (Team Leader Only) Creates a new task for the team they lead.
    """
    
    # --- 1. Validation: Check if the assigned_to user is real and active ---
    assigned_user_url = f"http://user_service:8001/users/{task_data.assigned_to}"
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {current_user.token}"}
            response = await client.get(assigned_user_url, headers=headers)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"User '{task_data.assigned_to}' not found in the system.")
        
        user_data = response.json()
        if not user_data.get("active"):
            raise HTTPException(status_code=400, detail="Assigned user is not active and cannot be assigned a task.")
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="User service is unreachable.")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error during user assignment validation.")


    # --- 2. Create the Task ---
    new_task = Task(
        team_id=validated_team_id, # Use the ID verified by security
        title=task_data.title,
        description=task_data.description,
        created_by=current_user.username,
        assigned_to=task_data.assigned_to,
        status=task_data.status,
        priority=task_data.priority,
        due_date=task_data.due_date,
        comments=[]
    )
    
    # --- 3. Save to MongoDB ---
    result = await db["tasks"].insert_one(new_task.model_dump(by_alias=True))
    created_task = await db["tasks"].find_one({"_id": result.inserted_id})
    
    return TaskOut(
        id=str(created_task["_id"]),
        **created_task
    )

#--------- UPDATE TASK (team leader only) --------

@router.patch("/{task_id}", response_model=TaskOut, tags=["tasks"])
async def update_task_details(
    task_data: TaskUpdate,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)], # <-- ADD THIS
    task_to_update: Task = Depends(get_task_leader_only)
):
    """
    (Admin or Task Creator/Team Leader Only) Updates specific fields of a task.
    """
    # 1. Prepare data for MongoDB
    update_data = task_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided.")
        
    # --- NEW VALIDATION CHECK ---
    if "assigned_to" in update_data:
        assigned_user = update_data["assigned_to"]
        
        user_service_url = f"http://user_service:8001/users/{assigned_user}"
        
        try:
            async with httpx.AsyncClient() as client:
                # Use the token from the current_user dependency
                headers = {"Authorization": f"Bearer {current_user.token}"}
                response = await client.get(user_service_url, headers=headers)
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"User '{assigned_user}' is either invalid or not part of the team.")
            
            user_data = response.json()
            if not user_data.get("active"):
                raise HTTPException(status_code=400, detail="Assigned user is not active and cannot be assigned a task.")
                
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="User service is unreachable.")
            
    # 2. Update the team in the database
    await db["tasks"].update_one(
        {"_id": task_to_update.id}, 
        {"$set": update_data}
    )
    
    # 3. Fetch the updated document and return it
    updated_task_doc = await db["tasks"].find_one({"_id": task_to_update.id})
    return TaskOut(id=str(updated_task_doc["_id"]), **updated_task_doc)

###### ONLY TASK UPDATE, meant for assigned member.
@router.patch("/{task_id}/status", response_model=TaskOut, tags=["tasks"])


async def update_task_status(
    task_id: str,
    status_data: TaskStatusUpdate,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """
    (Assigned User Only) Updates the status of a specific task.
    """
    
    # 1. Validate Task ID format
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # 2. Find the task
    task_doc = await db["tasks"].find_one({"_id": obj_id})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    task = Task(**task_doc)

    # 3. Security Check: Assigned User ONLY
    if current_user.username != task.assigned_to:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to change the status; only the assigned user can."
        )

    # 4. Update the status in the database
    await db["tasks"].update_one(
        {"_id": task.id},
        {"$set": {"status": status_data.status}}
    )
    
    # 5. Fetch and return the updated document
    updated_task_doc = await db["tasks"].find_one({"_id": task.id})
    return TaskOut(id=str(updated_task_doc["_id"]), **updated_task_doc)

# --------------- FILTER FUNCTIONS -------------

# User can view all the tasks assigned to them, from all teams
@router.get("/me", response_model=List[TaskOut], tags=["tasks"])
async def list_my_assigned_tasks(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    # --- NEW QUERY PARAMETERS ---
    status: Optional[TaskStatus] = None, # Filters by status (TODO, IN_PROGRESS, DONE)
    sort_by_due: Optional[bool] = False, # If True, sorts by due_date
    # ---------------------------
):
    query = {"assigned_to": current_user.username}
    
    # 1. Status Filtering
    if status:
        query["status"] = status.value # Use .value to get the string from the Enum
        
    # 2. Sorting Logic
    sort_criteria = []
    if sort_by_due:
        # Sort by due_date ascending (1)
        sort_criteria.append(("due_date", 1))

    # --- THE FIX ---
    tasks_cursor = db["tasks"].find(query)
    
    if sort_criteria: # <-- ONLY apply sort if criteria exist
        tasks_cursor = tasks_cursor.sort(sort_criteria)
    # --- END FIX ---

    tasks = await tasks_cursor.to_list(length=100)
    
    if not tasks:
        return []

    return [TaskOut(id=str(task["_id"]), **task) for task in tasks]

# User can see all the tasks of their team
@router.get("/team/{team_id}", response_model=List[TaskOut], tags=["tasks"])
async def list_tasks_by_team(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    # This dependency runs the security check and returns the validated ID.
    # It ensures the user is a member or admin of the team.
    validated_team_id: Annotated[str, Depends(get_team_access_for_tasks)], 
    
    # Query Parameters for filtering and sorting
    status: Optional[TaskStatus] = None, 
    sort_by_due: Optional[bool] = False,
):
    """
    (Team Members/Admins Only) Lists all tasks for a specific team, with optional filtering.
    """
    
    # 1. Build the MongoDB Query
    query = {"team_id": validated_team_id}
    
    if status:
        query["status"] = status.value
        
    # 1. Build the MongoDB Sort Criteria
    sort_criteria = []
    if sort_by_due:
        sort_criteria.append(("due_date", 1))

    # 2. Execute the Query
    tasks_cursor = db["tasks"].find(query)
    
    # --- FIX: Only apply sort if criteria exist ---
    if sort_criteria: 
        tasks_cursor = tasks_cursor.sort(sort_criteria)
    # --- END FIX ---

    tasks = await tasks_cursor.to_list(length=100)
    
    if not tasks:
        return []

    return [TaskOut(id=str(task["_id"]), **task) for task in tasks]

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tasks"])
async def delete_task(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    # This dependency runs all security checks and returns the Task object
    task_to_delete: Task = Depends(get_task_leader_only) 
):
    """
    (Admin or Task Creator/Team Leader Only) Deletes a task permanently.
    """
    # Use the ID from the validated Task object
    await db["tasks"].delete_one({"_id": task_to_delete.id})
    
    return None