from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from db import get_database
from schemas import TeamCreate, TeamOut, TokenData, Role, TeamUpdate, MemberAdd, LeaderAssign
from models import Team
from security import get_current_user, get_current_admin_user, get_team_leader_or_admin, get_team_leader_only, get_team_access_or_admin
from bson import ObjectId # For querying by ID
import httpx

router = APIRouter(prefix="/teams")

@router.get("/{team_id}", response_model=TeamOut, tags=["teams CRUD"])
async def get_team_details(
    team_id: str, # We need this for the new dependency
    db: AsyncIOMotorDatabase = Depends(get_database), # We need to re-add this dependency
    # CHANGE THIS DEPENDENCY:
    team: Team = Depends(get_team_access_or_admin) # <-- NEW VIEW ACCESS CHECK
):
    """
    (Admin or Member of Team Only) Get details for a single team.
    """
    # ... (rest of the function remains the same, as the dependency returns the team object)
    team_data = team.model_dump(by_alias=True)
    return TeamOut(id=str(team_data["_id"]), **team_data)

@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED, tags=["teams CRUD"])
async def create_team(
    team_data: TeamCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin_user: TokenData = Depends(get_current_admin_user)
):
    """
    (Admin Only) Create a new team.
    Assigns a user as leader and promotes them if needed.
    """
    new_leader_username = team_data.leader_username
    
    # --- 1. Safety Check: Does this user even exist? ---
    # We must call user_service to check.
    user_service_url = f"http://user_service:8001/users/{new_leader_username}"
    
    try:
        async with httpx.AsyncClient() as client:
            # We need to send our *own* admin token to prove we can access this
            auth_header = f"Bearer {admin_user.token}" # <-- We need to add this!
            headers = {"Authorization": auth_header}
            
            response = await client.get(user_service_url, headers=headers)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Team Leader username not found.")
        response.raise_for_status() # Catch other errors
        
        # User exists, get their data
        user_data = response.json()

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="User service is unreachable.")

    # --- 2. Create the Team ---
    new_team = Team(
        name=team_data.name,
        description=team_data.description,
        leader_id=user_data["username"], # Use the verified username
        member_ids=[user_data["username"]] # The leader is also a member
    )
    result = await db["teams"].insert_one(new_team.model_dump(by_alias=True))
    
    # --- 3. Implement Your Plan (Point 1 & 2) ---
    # Now, promote the user to "team_leader" in the user_service
    # (It's safe to do this even if they are already a leader)
    if user_data.get("role") != Role.ADMIN: # <-- THE NEW SAFETY CHECK
        promote_url = f"http://user_service:8001/users/{new_leader_username}/role"
        role_payload = {"role": "team_leader"}
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {admin_user.token}"} # Use admin token
                await client.patch(promote_url, json=role_payload, headers=headers)
                
        except Exception:
            # If this fails, we can just log it. The team is created,
            # but the role wasn't updated.
            print(f"Warning: Could not promote user {new_leader_username} in user_service.")

    # --- 4. Return the new team ---
    created_team = await db["teams"].find_one({"_id": result.inserted_id})
    return TeamOut(id=str(created_team["_id"]), **created_team)


@router.get("", response_model=List[TeamOut], tags=["list teams"])
async def list_teams(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: TokenData = Depends(get_current_user)
):
    """
    List all teams.
    - Admins see all teams.
    - Other users see only teams they are a member of.
    """
    query = {}
    if current_user.role != Role.ADMIN:
        # If not admin, find teams where user is a member or leader
        query = {
            "$or": [
                {"leader_id": current_user.username},
                {"member_ids": current_user.username}
            ]
        }
    
    teams_cursor = db["teams"].find(query)
    teams = await teams_cursor.to_list(length=100)
    
    # Convert MongoDB docs to TeamOut schema
    return [TeamOut(id=str(team["_id"]), **team) for team in teams]

# --- NEW INTERNAL ENDPOINT (for User-Service) ---
# User_management requests to know if a person is team leader, so the admin can know if they can delete him.

# This is a helper, NOT an endpoint
async def _is_user_still_leader(db: AsyncIOMotorDatabase, username: str) -> bool:
    count = await db["teams"].count_documents({"leader_id": username})
    return count > 0

@router.get("/leader/{username}", response_model=List[TeamOut], tags=["list teams"])
async def list_teams_led_by_user(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    # Security: Ensure only a logged-in user can access this.
    admin_user: TokenData = Depends(get_current_admin_user)
):
    """
    (Logged-in Users Only)
    Gets a list of all teams where the specified user is the leader.
    """
    # 1. Find all teams in the database where the leader_id matches
    teams_cursor = db["teams"].find({"leader_id": username})
    teams = await teams_cursor.to_list(length=100)

    # 2. If no teams are found, return an empty list
    if not teams:
        return []

    # 3. Convert the MongoDB documents to our TeamOut schema and return them
    return [TeamOut(id=str(team["_id"]), **team) for team in teams]

@router.get("/internal/is-leader/{username}", include_in_schema=False)
async def is_user_a_team_leader(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    (Internal Service-Only)
    Checks if a given username is the leader of *any* team.
    This endpoint is called by the User Service during deletion.
    It is hidden from the public Swagger docs.
    """
    # Look for any team where this user is the leader
    # We just need to know if at least one exists
    is_leader = await _is_user_still_leader(db, username)
    return {"is_leader": is_leader}

@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["teams CRUD"])
async def delete_team(
    team_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin_user: TokenData = Depends(get_current_admin_user)
):
    """
    (Admin Only) Deletes a team.
    If the leader of this team no longer leads any other teams,
    their role is demoted to "member" in the user_service.
    """
    try:
        team_object_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    # 1. Find the team we are about to delete
    team_to_delete = await db["teams"].find_one({"_id": team_object_id})
    if not team_to_delete:
        raise HTTPException(status_code=404, detail="Team not found")
    
    leader_username = team_to_delete["leader_id"]

    # 2. Delete the team
    await db["teams"].delete_one({"_id": team_object_id})

    # 3. Implement Your Plan (Point 3 & 4)
    # Check if this user is *still* a leader of any *other* team
    is_still_leader = await _is_user_still_leader(db, leader_username)
    
    if not is_still_leader:
        # If not, demote them in user_service
        demote_url = f"http://user_service:8001/users/{leader_username}/role"
        role_payload = {"role": "member"} # Demote to member
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {admin_user.token}"}
                await client.patch(demote_url, json=role_payload, headers=headers)
        except Exception:
            # Log this error. The team was deleted, but demotion failed.
            print(f"Warning: Team was deleted, but could not demote user {leader_username}.")

    return None # Return 204 No Content


# ------- UPDATE TEAM DETAILS ENDPOINT--------

# We're breaking the endpoints in two parts.
# THIS endpoint only allows us to change team name and details (admin & leader only).

@router.patch("/{team_id}", response_model=TeamOut, tags=["teams CRUD"])
async def update_team_details(
    team_data: TeamUpdate, # The JSON payload
    team: Team = Depends(get_team_leader_or_admin), # Our security check
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    (Admin or Team Leader Only)
    Update a team's name or description.
    """
    
    update_data = team_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided (name or description).")

    # Update the team in the database
    await db["teams"].update_one(
        {"_id": team.id},
        {"$set": update_data}
    )

    # Get the fresh document from the DB
    updated_team_doc = await db["teams"].find_one({"_id": team.id})
    
    return TeamOut(id=str(updated_team_doc["_id"]), **updated_team_doc)

# THIS endpoint only allows us to add members to the team as leader or admin.
@router.post("/{team_id}/members", response_model=TeamOut, tags=["team members"])
async def add_member_to_team(
    payload: MemberAdd, # The JSON body: {"username": "new_user"}
    team: Team = Depends(get_team_leader_only), # 1. Security: Checks if user is Admin/Leader
    current_user: TokenData = Depends(get_current_user), # 2. Gets the user's token for the next call
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    (Admin or Team Leader Only)
    Adds a new, validated member to a team.
    """
    new_member_username = payload.username

    # --- 1. Check if user is already in the team ---
    if new_member_username in team.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this team"
        )

    # --- 2. Inter-Service Validation (The critical check) ---
    # We must call the user_service to see if this user is real and active.
    user_service_url = f"http://user_service:8001/users/{new_member_username}"
    try:
        async with httpx.AsyncClient() as client:
            # We must use our *own* token to prove we are allowed to see user data
            auth_header = f"Bearer {current_user.token}" 
            headers = {"Authorization": auth_header}
            
            response = await client.get(user_service_url, headers=headers)
        
        # If user_service returns 404, the user doesn't exist
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="User to add not found.")
        
        response.raise_for_status() # Catch other errors (like 500)
        
        # We got a 200 OK, now check if the user is active
        user_data = response.json()
        if not user_data.get("active"):
            raise HTTPException(status_code=400, detail="User is not active and cannot be added.")

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="User service is unreachable.")

    # --- 3. Add to Database ---
    # "$addToSet" is a MongoDB operator that adds an item to an array
    # only if it's not already there. It's safer than "$push".
    await db["teams"].update_one(
        {"_id": team.id},
        {"$addToSet": {"member_ids": new_member_username}}
    )

    # --- 4. Return the fully updated team ---
    updated_team_doc = await db["teams"].find_one({"_id": team.id})
    return TeamOut(id=str(updated_team_doc["_id"]), **updated_team_doc)


#This allows us to remove a member from a team, as admins or leaders
@router.delete("/{team_id}/members/{username_to_remove}", response_model=TeamOut, tags=["team members"])
async def remove_member_from_team(
    username_to_remove: str, # The member to remove (from the URL)
    team: Team = Depends(get_team_leader_only), # 1. Security: Checks if user is Admin/Leader
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    (Admin or Team Leader Only)
    Removes a member from a team.
    """

    # --- 1. Business Rule: Check if user is the Team Leader ---
    if username_to_remove == team.leader_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the Team Leader. Please reassign leadership first."
        )

    # --- 2. Check if user is actually in the team ---
    if username_to_remove not in team.member_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team."
        )

    # --- 3. Remove from Database ---
    # "$pull" is the MongoDB operator to remove a specific item
    # from an array.
    await db["teams"].update_one(
        {"_id": team.id},
        {"$pull": {"member_ids": username_to_remove}}
    )

    # --- 4. Return the fully updated team ---
    updated_team_doc = await db["teams"].find_one({"_id": team.id})
    return TeamOut(id=str(updated_team_doc["_id"]), **updated_team_doc)



@router.patch("/{team_id}/assign-leader", response_model=TeamOut, tags=["team members"])
async def assign_team_leader(
    team_id: str, # <-- 1. We get the team_id from the path
    payload: LeaderAssign, 
    admin_user: TokenData = Depends(get_current_admin_user), # <-- 2. THE FIX: Admin-only
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    (Admin Only)
    Assigns a new leader to a team.
    Validates the new leader, promotes them, and ensures they are
    a member of the team. Demotes the old leader if necessary.
    """
    new_leader_username = payload.new_leader_username
    
    # --- 3. We must now manually fetch the team ---
    try:
        obj_id = ObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    team_doc = await db["teams"].find_one({"_id": obj_id})
    if not team_doc:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team = Team(**team_doc) # We have the team object now
    old_leader_username = team.leader_id
    # --- End of manual fetch ---

    # --- Business Rule Checks ---
    if new_leader_username == old_leader_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already the team leader."
        )

    # --- Inter-Service Validation: Check if new leader is a real, active user ---
    user_service_url = f"http://user_service:8001/users/{new_leader_username}"
    try:
        async with httpx.AsyncClient() as client:
            # We use the Admin's token for the call
            auth_header = f"Bearer {admin_user.token}"
            headers = {"Authorization": auth_header}
            response = await client.get(user_service_url, headers=headers)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"User '{new_leader_username}' not found.")
        response.raise_for_status()
        
        user_data = response.json()
        if not user_data.get("active"):
            raise HTTPException(status_code=400, detail=f"User '{new_leader_username}' is not active.")

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="User service is unreachable.")

    # --- Update MongoDB Database ---
    await db["teams"].update_one(
        {"_id": team.id},
        {
            "$set": {"leader_id": new_leader_username},
            "$addToSet": {"member_ids": new_leader_username}
        }
    )

    # --- Sync with User Service (Promote/Demote) ---
    auth_header = {"Authorization": f"Bearer {admin_user.token}"}
    
    # a. Promote the new leader
    if user_data.get("role") != Role.ADMIN: # <-- THE NEW SAFETY CHECK
        try:
            promote_url = f"http://user_service:8001/users/{new_leader_username}/role"
            async with httpx.AsyncClient() as client:
                await client.patch(promote_url, json={"role": "team_leader"}, headers=auth_header)
        except Exception as e:
            print(f"Warning: Could not promote new leader {new_leader_username}. Error: {e}")
        
    # b. Check and demote the old leader
    is_still_leader = await _is_user_still_leader(db, old_leader_username)
    if not is_still_leader:
        try:
            demote_url = f"http://user_service:8001/users/{old_leader_username}/role"
            async with httpx.AsyncClient() as client:
                await client.patch(demote_url, json={"role": "member"}, headers=auth_header)
        except Exception as e:
            print(f"Warning: Could not demote old leader {old_leader_username}. Error: {e}")

    # --- Return the updated team ---
    updated_team_doc = await db["teams"].find_one({"_id": team.id})
    return TeamOut(id=str(updated_team_doc["_id"]), **updated_team_doc)