from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserSummaryResponse
from app.services.user_service import list_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserSummaryResponse])
def get_users(
    query: str | None = Query(default=None, min_length=1, max_length=255),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserSummaryResponse]:
    users = list_users(db, query=query, limit=limit)
    return [UserSummaryResponse.model_validate(user) for user in users]
