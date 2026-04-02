from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.assignment import ProjectAssignment
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User


def list_assignments_for_project(db: Session, project_id: int) -> list[ProjectAssignment]:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    stmt = (
        select(ProjectAssignment)
        .options(selectinload(ProjectAssignment.user))
        .join(User, ProjectAssignment.user_id == User.id)
        .where(ProjectAssignment.project_id == project_id)
        .where(User.role == UserRole.STANDARD)
        .order_by(ProjectAssignment.id)
    )
    return list(db.scalars(stmt).all())


def create_assignment(db: Session, project_id: int, user_id: int) -> ProjectAssignment:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins already have access to every project.",
        )

    existing = db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already assigned to the project.",
        )

    assignment = ProjectAssignment(project_id=project_id, user_id=user_id)
    db.add(assignment)
    db.commit()

    created = db.scalar(
        select(ProjectAssignment)
        .options(selectinload(ProjectAssignment.user))
        .where(ProjectAssignment.id == assignment.id)
    )
    return created


def delete_assignment(db: Session, project_id: int, user_id: int) -> None:
    assignment = db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.user_id == user_id,
        )
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )

    db.delete(assignment)
    db.commit()
