from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.assignment import ProjectAssignmentCreate, ProjectAssignmentResponse
from app.services.assignment_service import (
    create_assignment,
    delete_assignment,
    list_assignments_for_project,
)

router = APIRouter(tags=["assignments"])


@router.get(
    "/projects/{project_id}/assignments",
    response_model=list[ProjectAssignmentResponse],
)
def get_project_assignments(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[ProjectAssignmentResponse]:
    assignments = list_assignments_for_project(db, project_id)
    return [ProjectAssignmentResponse.model_validate(item) for item in assignments]


@router.post(
    "/projects/{project_id}/assignments",
    response_model=ProjectAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project_assignment(
    project_id: int,
    payload: ProjectAssignmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProjectAssignmentResponse:
    assignment = create_assignment(db, project_id, payload.user_id)
    return ProjectAssignmentResponse.model_validate(assignment)


@router.delete(
    "/projects/{project_id}/assignments/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_assignment(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    delete_assignment(db, project_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)