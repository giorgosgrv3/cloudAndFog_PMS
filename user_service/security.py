from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.hash import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from pydantic import ValidationError # Νέο Import
from sqlalchemy.orm import Session # Νέο Import

from models import Role, User # Νέο Import
from schemas import TokenData # Νέο Import
from db import get_db # Νέο Import
import os # <-- ΠΡΟΣΘΕΣΕ ΑΥΤΟ

# --- Ρυθμίσεις Ασφαλείας ---
SECRET_KEY = os.getenv("SECRET_KEY", "default_secret_please_change")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# -------------- Password Hashing -----------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.verify(plain_password, hashed_password) #checks if the passwd provided in sign in matches the one in the DB

def get_password_hash(password: str) -> str:
    return bcrypt.hash(password) #hash passwd provided by user, used in routes.py when user registers

# ----------------- JWT Token Creation ------------------

# called by login_for_access_token
# takes the data given to it, adds the expiration time (1hr), encrypts the data using jwt.encode()
# sends it back to login_for_access_token
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --------------------------------------------------------------------
# --- ΝΕΟΣ ΚΩΔΙΚΑΣ: Token Validation & Dependencies ---
# --------------------------------------------------------------------

# Αυτό λέει στο Swagger "Ψάξε για το token στο endpoint /users/token"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/token")

# Ορίζουμε ένα standard σφάλμα για να το επαναχρησιμοποιούμε
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Η βασική Dependency: Παίρνει το token, το σπάει, βρίσκει τον χρήστη.
    Αυτός είναι ο "Έλεγχος Κλειδιού".
    """
    try:
        # 1. Αποκωδικοποίησε το token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Πάρε τα δεδομένα από το token
        token_data = TokenData(
            username=payload.get("sub"), 
            role=payload.get("role")
        )
        
        if token_data.username is None:
            raise credentials_exception
            
    except (JWTError, ValidationError):
        # Αν το token είναι άκυρο ή ληγμένο, πέτα σφάλμα
        raise credentials_exception

    # 3. Βρες τον χρήστη στη βάση
    user = db.query(User).filter(User.username == token_data.username).first()
    
    if user is None:
        # Αν ο χρήστης διαγράφηκε αφού πήρε το token
        raise credentials_exception
        
    # 4. Έλεγξε αν είναι active
    if not user.active:
        # Αν ο λογαριασμός απενεργοποιήθηκε
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Η Dependency για Admins: Εξαρτάται από την προηγούμενη
    και απλά ελέγχει τον ρόλο.
    Αυτός είναι ο "Πορτιέρης".
    """
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user does not have privileges to perform this action"
        )
    return current_user