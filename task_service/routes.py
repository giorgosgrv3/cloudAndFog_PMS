
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, List, Optional # ADD THIS
import os
from pathlib import Path

from db import get_database
from schemas import (TaskCreate, TaskOut, TokenData, TaskStatus, TaskUpdate,
                    TaskStatusUpdate, Role, CommentIn, CommentOut, AttachmentOut)
from models import Task, PyObjectId, Comment, Attachment
from security import (get_current_user, get_validated_team_leader, get_team_access_for_tasks,
                    get_task_leader_only, authorize_comment_deletion) # Import the new dependency
import httpx
import logging
logger = logging.getLogger("task_service")


router = APIRouter(prefix="/tasks")

UPLOAD_BASE_DIR = Path("task_files")
UPLOAD_BASE_DIR.mkdir(exist_ok=True)

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED, tags=["tasks"])
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

    logger.info("Task created : task_id=%s, team_id=%s, created_by=%s, assigned_to=%s",
    str(result.inserted_id),
    validated_team_id,
    current_user.username,
    task_data.assigned_to,
    )

    return TaskOut(
        id=str(created_task["_id"]),
        **created_task
    )

@router.get("/{task_id}", response_model=TaskOut, tags=["tasks"])
async def get_task_details(
    task_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """
    (Member/Leader/Admin) Retrieves details of a single task.
    Requires user to be a member of the task's team (or Admin).
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
    
    # 3. Security Check: Check if user has access to the team
    # We extract the team_id from the task and verify access
    team_id = task_doc["team_id"]
    await get_team_access_for_tasks(team_id, current_user)

    # 4. Return the task
    return TaskOut(id=str(task_doc["_id"]), **task_doc)

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

@router.post("/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED, tags=["comments"])
async def add_comment_to_task(
    task_id: str,
    comment_data: CommentIn,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """
    (Team Member/Leader/Admin) Adds a new comment to a specific task.
    Requires user to be a member of the task's team.
    """
    # 1. Validate Task ID format
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # 2. Find the task and get the team_id
    task_doc = await db["tasks"].find_one({"_id": obj_id}, projection={"team_id": 1})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    team_id = task_doc["team_id"]
    
    # 3. Security Check: Check if user has access to the team
    # We call the dependency's logic directly to reuse the powerful ISC check
    await get_team_access_for_tasks(team_id, current_user)

    # 4. Create the new Comment object (using model_dump for clean nested insertion)
    new_comment = Comment(
        text=comment_data.text,
        created_by=current_user.username,
    )
    
    # 5. Insert the comment into the nested 'comments' array in MongoDB
    result = await db["tasks"].update_one(
        {"_id": obj_id},
        {"$push": {"comments": new_comment.model_dump(by_alias=True)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to add comment.")
        
    # Return the newly created comment object (with the generated ID and timestamp)
    # Since MongoDB generated the ID, we return the object we created locally.
    return CommentOut(
        id=str(new_comment.id),
        text=new_comment.text,
        created_by=new_comment.created_by,
        created_at=new_comment.created_at
    )


@router.get("/{task_id}/comments", response_model=List[CommentOut], tags=["comments"])
async def get_all_task_comments(
    task_id: str,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    current_user: Annotated[TokenData, Depends(get_current_user)]
):
    """
    (Team Member/Leader/Admin) Retrieves all comments for a specific task.
    Requires user to be a member of the task's team.
    """
    # 1. Validate Task ID format
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # 2. Find the task and get the team_id
    task_doc = await db["tasks"].find_one({"_id": obj_id}, projection={"team_id": 1})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")
    
    team_id = task_doc["team_id"]
    
    # 3. Security Check: Check if user has access to the team
    await get_team_access_for_tasks(team_id, current_user)
    
    # 4. Retrieve the full task document, but only include the comments array
    task_with_comments = await db["tasks"].find_one(
        {"_id": obj_id}, 
        projection={"comments": 1}
    )
    
    if not task_with_comments or 'comments' not in task_with_comments:
        return []
        
    # 5. Convert MongoDB documents to Pydantic CommentOut objects
    comments_list = task_with_comments['comments']
    
    return [CommentOut(id=str(comment["_id"]), **comment) for comment in comments_list]

@router.delete("/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["comments"])
async def delete_comment(
    db: Annotated[AsyncIOMotorDatabase, Depends(get_database)],
    task_id: Annotated[PyObjectId, Depends(authorize_comment_deletion)], # Task ID returned by the dependency
    comment_id: str # Required by the path, but the ID is validated in the dependency
):
    """
    (Comment Creator, Team Leader, or Admin Only) Deletes a specific comment.
    """
    
    # The dependency ensures the user is authorized and returns the validated task_id
    comment_obj_id = PyObjectId(comment_id)
    
    # Use MongoDB's $pull operator to remove the nested document from the comments array
    result = await db["tasks"].update_one(
        {"_id": task_id}, 
        {"$pull": {"comments": {"_id": comment_obj_id}}}
    )
    
    if result.modified_count == 0:
        # If modified_count is 0, it means the comment wasn't removed. 
        # Since the task/comment were found and user was authorized (by the dependency),
        # this case is unlikely but handles a race condition or a server error.
        raise HTTPException(status_code=500, detail="Failed to delete comment or comment was already gone.")
        
    return None

@router.post("/{task_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED, tags=["attachments"])
async def upload_task_attachment(
    task_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: TokenData = Depends(get_current_user),
):
    """
    (Team Member/Leader/Admin)
    Upload a file attachment for a specific task.
    Access is allowed only if the user belongs to the task's team
    (or is an Admin), same as comments logic.
    """
    # 1. Validate task ID
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # 2. Find task and get its team_id
    task_doc = await db["tasks"].find_one({"_id": obj_id}, projection={"team_id": 1})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")

    team_id = task_doc["team_id"]

    # 3. Reuse team access check (Admin or Member of that team)
    await get_team_access_for_tasks(team_id, current_user)

    # 4. Prepare filesystem path
    task_dir = UPLOAD_BASE_DIR / str(task_id)
    task_dir.mkdir(parents=True, exist_ok=True)

    # We'll create a new ObjectId for the attachment and use it in the filename
    attachment_id = PyObjectId()
    safe_filename = file.filename or "attachment"
    # Path on disk: task_files/<task_id>/<attachment_id>_<original_name>
    stored_path = task_dir / f"{attachment_id}_{safe_filename}"

    # 5. Save file to disk
    file_bytes = await file.read()
    try:
        with open(stored_path, "wb") as f:
            f.write(file_bytes)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save file on server.")

    # 6. Build Attachment model and push to MongoDB
    attachment = Attachment(
        id=attachment_id,
        filename=safe_filename,
        content_type=file.content_type or "application/octet-stream",
        path=str(stored_path),
        uploaded_by=current_user.username,
    )

    result = await db["tasks"].update_one(
        {"_id": obj_id},
        {"$push": {"attachments": attachment.model_dump(by_alias=True)}},
    )

    if result.modified_count == 0:
        # Roll back file if DB update failed
        try:
            os.remove(stored_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Failed to attach file to task.")

    return AttachmentOut(
        id=str(attachment.id),
        filename=attachment.filename,
        content_type=attachment.content_type,
        uploaded_by=attachment.uploaded_by,
        uploaded_at=attachment.uploaded_at,
    )

@router.get("/{task_id}/attachments", response_model=List[AttachmentOut], tags=["attachments"])
async def list_task_attachments(
    task_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: TokenData = Depends(get_current_user),
):
    """
    (Team Member/Leader/Admin)
    List all attachments metadata for a task.
    """
    try:
        obj_id = PyObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    # Get team_id and attachments in one shot
    task_doc = await db["tasks"].find_one(
        {"_id": obj_id},
        projection={"team_id": 1, "attachments": 1},
    )
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")

    team_id = task_doc["team_id"]
    await get_team_access_for_tasks(team_id, current_user)

    attachments = task_doc.get("attachments", [])
    return [
        AttachmentOut(
            id=str(att["_id"]),
            filename=att["filename"],
            content_type=att["content_type"],
            uploaded_by=att["uploaded_by"],
            uploaded_at=att["uploaded_at"],
        )
        for att in attachments
    ]

@router.get("/{task_id}/attachments/{attachment_id}", response_class=FileResponse, tags=["attachments"])
async def download_task_attachment(
    task_id: str,
    attachment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: TokenData = Depends(get_current_user),
):
    """
    (Team Member/Leader/Admin)
    Download a specific attachment file from a task.
    """
    # Validate IDs
    try:
        task_obj_id = PyObjectId(task_id)
        attachment_obj_id = PyObjectId(attachment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task or attachment ID format.")

    # Fetch task with team and attachments
    task_doc = await db["tasks"].find_one(
        {"_id": task_obj_id},
        projection={"team_id": 1, "attachments": 1},
    )
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")

    team_id = task_doc["team_id"]
    await get_team_access_for_tasks(team_id, current_user)

    attachments = task_doc.get("attachments", [])
    attachment = next((a for a in attachments if a["_id"] == attachment_obj_id), None)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    file_path = attachment["path"]
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=410, detail="Attachment file no longer exists on server.")
    
    resolved = Path(file_path).resolve()
    base = UPLOAD_BASE_DIR.resolve()

    if base not in resolved.parents and resolved != base:
    # The stored path points outside our uploads directory → suspicious
        raise HTTPException(status_code=500, detail="Invalid attachment path on server.")

    # FileResponse will handle streaming and content-type
    return FileResponse(
        path=file_path,
        media_type=attachment.get("content_type", "application/octet-stream"),
        filename=attachment.get("filename", "download"),
    )

@router.delete("/{task_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["attachments"])
async def delete_task_attachment(
    task_id: str,
    attachment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: TokenData = Depends(get_current_user),
):
    """
    (Uploader, Team Leader, or Admin Only)
    Deletes a specific attachment from a task and removes the file from disk.
    """
    # 1. Validate IDs
    try:
        task_obj_id = PyObjectId(task_id)
        attachment_obj_id = PyObjectId(attachment_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task or attachment ID format.")

    # 2. Find the task
    task_doc = await db["tasks"].find_one(
        {"_id": task_obj_id},
        projection={"team_id": 1, "attachments": 1}
    )
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found.")

    # 3. Find the attachment
    attachments = task_doc.get("attachments", [])
    target_attachment = next((a for a in attachments if a["_id"] == attachment_obj_id), None)
    
    if not target_attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    # 4. Security Check (Authorization)
    # Rules: 
    # - Admin: Can delete anything
    # - Team Leader: Can delete anything in their team (Check via Team Service or role)
    # - Member: Can ONLY delete their own uploads
    
    is_uploader = target_attachment["uploaded_by"] == current_user.username
    is_admin = current_user.role == Role.ADMIN
    
    # Check if Leader (we need the team_id)
    is_leader = False
    if current_user.role == Role.TEAM_LEADER:
        # Verify with Team Service if they lead this specific team
        team_id = task_doc["team_id"]
        try:
            # Internal call to verify leadership
            team_service_url = f"http://team_service:8002/teams/{team_id}"
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {current_user.token}"}
                response = await client.get(team_service_url, headers=headers)
                # If they can edit the team (PATCH), they are the leader (or admin)
                # But simpler: just check if the response says they are the leader
                if response.status_code == 200:
                    team_data = response.json()
                    if team_data.get("leader_id") == current_user.username:
                        is_leader = True
        except Exception:
            pass # If check fails, fallback to other permissions

    if not (is_uploader or is_leader or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not authorized to delete this file."
        )

    # 5. Delete file from disk
    file_path = Path(target_attachment["path"])
    try:
        if file_path.exists():
            os.remove(file_path)
    except Exception as e:
        logger.error(f"Failed to delete file from disk: {e}")
        # We proceed to delete from DB anyway to keep data consistent

    # 6. Remove from MongoDB
    await db["tasks"].update_one(
        {"_id": task_obj_id},
        {"$pull": {"attachments": {"_id": attachment_obj_id}}}
    )

    return None
