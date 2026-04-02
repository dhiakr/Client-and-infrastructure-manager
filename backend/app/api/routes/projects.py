from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.assignment import ProjectAssignmentResponse
from app.schemas.client import ClientSummaryResponse
from app.schemas.instance import InstanceResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ProjectWorkspaceResponse,
)
from app.services.permission_service import is_admin
from app.services.project_service import (
    create_project,
    delete_project,
    get_project_for_user_with_related,
    list_projects_with_related,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _serialize_project_workspace(
    project,
    *,
    include_assignments: bool,
) -> ProjectWorkspaceResponse:
    return ProjectWorkspaceResponse(
        id=project.id,
        client_id=project.client_id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        client=ClientSummaryResponse.model_validate(project.client),
        instances=[InstanceResponse.model_validate(instance) for instance in project.instances],
        assignments=(
            [
                ProjectAssignmentResponse.model_validate(assignment)
                for assignment in project.assignments
                if assignment.user.role == UserRole.STANDARD
            ]
            if include_assignments
            else []
        ),
    )


@router.get("", response_model=list[ProjectWorkspaceResponse])
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectWorkspaceResponse]:
    include_assignments = is_admin(current_user)
    projects = list_projects_with_related(db, current_user)
    return [
        _serialize_project_workspace(project, include_assignments=include_assignments)
        for project in projects
    ]


@router.get("/{project_id}", response_model=ProjectWorkspaceResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectWorkspaceResponse:
    project = get_project_for_user_with_related(db, current_user, project_id)
    return _serialize_project_workspace(
        project,
        include_assignments=is_admin(current_user),
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_route(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProjectResponse:
    project = create_project(db, payload)
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project_route(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    project = update_project(db, current_user, project_id, payload)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_route(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    delete_project(db, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
