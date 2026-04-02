from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User


def is_admin(user: User) -> bool:
    role_value = user.role.value if isinstance(user.role, UserRole) else str(user.role)
    return role_value == UserRole.ADMIN.value


def assert_project_access(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    if is_admin(user):
        return project

    assignment_exists = db.scalar(
        select(ProjectAssignment.id).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user.id,
        )
    )

    if assignment_exists is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )

    return project


def assert_client_access(db: Session, user: User, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    if is_admin(user):
        return client

    accessible_project_exists = db.scalar(
        select(Project.id)
        .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
        .where(
            Project.client_id == client_id,
            ProjectAssignment.user_id == user.id,
        )
        .limit(1)
    )

    if accessible_project_exists is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this client.",
        )

    return client