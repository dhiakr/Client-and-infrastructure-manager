from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.user import User


def list_users(
    db: Session,
    query: str | None = None,
    limit: int = 20,
) -> list[User]:
    stmt = (
        select(User)
        .where(User.role == UserRole.STANDARD)
        .order_by(User.name, User.email)
    )

    clean_query = (query or "").strip()
    if clean_query:
        pattern = f"%{clean_query}%"
        stmt = stmt.where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    safe_limit = min(max(limit, 1), 50)
    stmt = stmt.limit(safe_limit)

    return list(db.scalars(stmt).all())
