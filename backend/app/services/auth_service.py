from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, TokenResponse


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def serialize_user(user: User) -> CurrentUserResponse:
    role_value = user.role.value if isinstance(user.role, UserRole) else str(user.role)

    return CurrentUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=role_value,  # type: ignore[arg-type]
    )


def build_login_response(user: User) -> TokenResponse:
    role_value = user.role.value if isinstance(user.role, UserRole) else str(user.role)

    token = create_access_token(
        subject=user.id,
        additional_claims={"role": role_value},
    )

    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=serialize_user(user),
    )
