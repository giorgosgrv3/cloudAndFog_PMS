from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm 
from sqlalchemy.orm import Session
from schemas import UserCreate, UserOut, Token, UserRoleUpdate # <-- Πρόσθεσε το UserRoleUpdate
import httpx

# ΑΛΛΑΓΗ: Πρόσθεσε τα get_current_user & get_current_admin_user
from security import (
    verify_password, 
    create_access_token, 
    get_password_hash,
    get_current_user,
    get_current_admin_user
)
from models import User, Role
from db import get_db

router = APIRouter(prefix="/users") # Αφαίρεσε το tags=["users"]

# ------------- AUTH ENDPOINT --------------

# we send username and passwd to endpoint POST users/token.
# server finds the user in the DB, verifies passwd, checks if active==True.
# if active, the server creates the data for the token, and asks for token creation, calling create_access_token()
# create_access_token() returns the token, and server gives it back to us.
# we now hold the token, and it's our responsibility as clients to show the token where we have to for authorization.
@router.post("/token", response_model=Token, tags=["auth"])
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user. Please contact administrator for activation."
        )
    token_data = {"sub": user.username, "role": user.role.value}
    access_token = create_access_token(data=token_data)
    return {"access_token": access_token, "token_type": "bearer"}


# --- ADMIN ENDPOINTS (ΝΕΟ!) ---

@router.patch("/{username}/activate", response_model=UserOut, tags=["admin"])
def activate_user(
    username: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    (Admin Only) Ενεργοποιεί έναν χρήστη.
    """
    print(f"Admin user '{admin_user.username}' is activating '{username}'")
    user_to_activate = db.query(User).filter(User.username == username).first()
    
    if not user_to_activate:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_to_activate.active:
        raise HTTPException(status_code=400, detail="User is already active")
        
    user_to_activate.active = True
    db.commit()
    db.refresh(user_to_activate)
    return user_to_activate

@router.patch("/{username}/role", response_model=UserOut, tags=["admin"])
def update_user_role(
    username: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    (Admin Only) Changes a user's role.
    Prevents demotion of active Team Leaders and prevents unsupported promotions (Member -> Leader).
    """
    
    user_to_update = db.query(User).filter(User.username == username).first()
    
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 1. PREVENT ADMIN DEMOTION (Existing Check)
    if user_to_update.role == Role.ADMIN and payload.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot demote an Admin account via the API."
        )
    
    # 2. NEW CHECK: PREVENT MEMBER -> LEADER PROMOTION VIA ADMIN PANEL (Manual promotion)
    # The system is designed for a Member to become a Leader automatically 
    # when assigned to lead a team. Manual promotion is disallowed.
    if user_to_update.role == Role.MEMBER and payload.role == Role.TEAM_LEADER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot promote Member to Team Leader manually. The user must be assigned as a leader to a team for the role to update automatically."
        )


    # 3. CHECK: PREVENT TEAM LEADER DEMOTION TO MEMBER (Existing Check)
    if user_to_update.role == Role.TEAM_LEADER and payload.role == Role.MEMBER:
        
        is_leader = False
        
        # --- ISC: Check Team Service for Active Teams ---
        try:
            url = f"http://team_service:8002/teams/internal/is-leader/{username}"
            with httpx.Client() as client:
                response = client.get(url)
            
            response.raise_for_status() 
            data = response.json()
            is_leader = data.get("is_leader", False)
            
        except httpx.ConnectError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Team service is unreachable. Cannot verify leader status for demotion."
            )
        except Exception as e:
            print(f"Error during leadership check for role update: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while verifying team leadership."
            )
        
        # --- BUSINESS RULE ENFORCEMENT ---
        if is_leader:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote user to Member: User is currently leading one or more teams. Reassign their teams first."
            )
            
    # 4. Apply the Role Update (If all checks pass)
    user_to_update.role = payload.role
    db.commit()
    db.refresh(user_to_update)
    return user_to_update

@router.patch("/{username}/deactivate", response_model=UserOut, tags=["admin"])
def deactivate_user(
    username: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    (Admin Only) Απενεργοποιεί έναν χρήστη.
    """
    print(f"Admin user '{admin_user.username}' is deactivating '{username}'")
    user_to_deactivate = db.query(User).filter(User.username == username).first()
    
    if not user_to_deactivate:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_deactivate.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot deactivate an admin account")
        
    user_to_deactivate.active = False
    db.commit()
    db.refresh(user_to_deactivate)
    return user_to_deactivate

@router.delete("/{username}", status_code=status.HTTP_204_NO_CONTENT, tags=["admin"])
def delete_user(
    username: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    (Admin Only) Deletes a user, *after* checking they are not a leader.
    """
    print(f"Admin user '{admin_user.username}' is attempting to DELETE '{username}'")
    
    is_leader = False # Default to False
    
    # --- 1. SAFETY CHECK (Try block is ONLY for the network call) ---
    try:
        url = f"http://team_service:8002/teams/internal/is-leader/{username}"
        with httpx.Client() as client:
            response = client.get(url)
        
        response.raise_for_status() 
        data = response.json()
        is_leader = data.get("is_leader", False) # Store the result

    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team service is unreachable. Cannot verify leader status."
        )
    except Exception as e:
        print(f"Error during leadership check: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while verifying team leadership."
        )
    
    # --- 2. BUSINESS LOGIC (Moved OUTSIDE the try block) ---
    if is_leader:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete user: This user is a Team Leader. Please reassign their teams first."
        )
    
    # --- 3. DELETE LOGIC (Now safe to run) ---
    user_to_delete = db.query(User).filter(User.username == username).first()
    
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete an admin account")
        
    db.delete(user_to_delete)
    db.commit()
    
    return None

# --- USER ENDPOINTS (Ενημερωμένα/Κλειδωμένα) ---

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    # (Αυτό μένει ίδιο - η δημιουργία χρήστη είναι ανοιχτή)
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists. Please log in.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists. Please log in.")

    user = User(
        username=payload.username,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        password_hash=get_password_hash(payload.password),
        role=Role.MEMBER,
        active=False,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


@router.get("", response_model=list[UserOut], tags=["users"])
def list_users(
    db: Session = Depends(get_db),
    # ΑΛΛΑΓΗ: Πρόσθεσε αυτή τη "κλειδαριά".
    # Αν το token λείπει ή είναι άκυρο, το request σταματάει εδώ.
    current_user: User = Depends(get_current_user)
):
    """
    (Logged-in Users Only) Επιστρέφει μια λίστα όλων των χρηστών.
    """
    print(f"User '{current_user.username}' is requesting user list.")
    return db.query(User).all()


@router.get("/me", response_model=UserOut, tags=["users"])
def get_current_user_me(
    # ΑΛΛΑΓΗ: Ένα νέο, βολικό endpoint
    current_user: User = Depends(get_current_user)
):
    """
    (Logged-in Users Only) Επιστρέφει τα στοιχεία του 
    χρήστη που είναι συνδεδεμένος.
    """
    return current_user


@router.get("/{username}", response_model=UserOut, tags=["users"])
def get_user(
    username: str, 
    db: Session = Depends(get_db),
    # ΑΛΛΑΓΗ: Πρόσθεσε την ίδια "κλειδαριά"
    current_user: User = Depends(get_current_user)
):
    """
    (Logged-in Users Only) Επιστρέφει τα στοιχεία ενός χρήστη.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user