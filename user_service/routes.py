from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm 
from sqlalchemy.orm import Session
from schemas import UserCreate, UserOut, Token, UserRoleUpdate # <-- Πρόσθεσε το UserRoleUpdate

# ΑΛΛΑΓΗ: Πρόσθεσε τα get_current_user & get_current_admin_user
from security import (
    verify_password, 
    create_access_token, 
    get_password_hash,
    get_current_user,
    get_current_admin_user
)
from schemas import UserCreate, UserOut, Token
from models import User, Role
from db import get_db

router = APIRouter(prefix="/users") # Αφαίρεσε το tags=["users"]

# --- AUTH ENDPOINT ---
# (Μένει ίδιο)
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
    (Admin Only) Αλλάζει τον ρόλο ενός χρήστη.
    """
    print(f"Admin user '{admin_user.username}' is changing role for '{username}'")
    user_to_update = db.query(User).filter(User.username == username).first()
    
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")
        
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
    (Admin Only) Διαγράφει μόνιμα έναν χρήστη.
    *** ΠΡΟΣΟΧΗ: Αυτή η ενέργεια δεν αναιρείται! ***
    """
    print(f"Admin user '{admin_user.username}' is DELETING '{username}'")
    
    user_to_delete = db.query(User).filter(User.username == username).first()
    
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete an admin account")
        
    db.delete(user_to_delete)
    db.commit()
    
    # Ένα DELETE request συνήθως επιστρέφει 204 No Content,
    # που σημαίνει "Πέτυχε, δεν έχω τίποτα να σου δείξω"
    return None

# --- USER ENDPOINTS (Ενημερωμένα/Κλειδωμένα) ---

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    # (Αυτό μένει ίδιο - η δημιουργία χρήστη είναι ανοιχτή)
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

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