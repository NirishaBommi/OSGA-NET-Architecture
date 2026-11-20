from __future__ import annotations
from typing import Generator
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import settings
from .security import decode_access_token
from ..db.session import SessionLocal
from ..db.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token_header: str | None = Depends(oauth2_scheme),
) -> User:
    # Check cookie first, then authorization header
    token = request.cookies.get(settings.COOKIE_NAME) or token_header
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    sub = decode_access_token(token)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == int(sub), User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_or_guest(
    request: Request,
    db: Session = Depends(get_db),
    token_header: str | None = Depends(oauth2_scheme),
) -> User:
    token = request.cookies.get(settings.COOKIE_NAME) or token_header
    if token:
        sub = decode_access_token(token)
        if sub:
            user = db.query(User).filter(User.id == int(sub), User.is_active == True).first()
            if user:
                return user

    # Fallback to guest clinician for seamless direct dashboard access
    guest = db.query(User).filter(User.username == "guest_clinician").first()
    if not guest:
        from .security import hash_password
        guest = User(
            username="guest_clinician",
            email="guest@osga-net.local",
            hashed_password=hash_password("guest123"),
            full_name="Guest Clinician",
            role="clinician",
            is_active=True,
        )
        db.add(guest)
        db.commit()
        db.refresh(guest)
    return guest

