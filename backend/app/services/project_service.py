from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.permission_service import assert_project_access, is_admin


def list_projects(db: Session, current_user: User) -> list[Project]:
    if is_admin(current_user):
        stmt = select(Project).order_by(Project.name)
        return list(db.scalars(stmt).all())

    stmt = (
        select(Project)
        .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
        .where(ProjectAssignment.user_id == current_user.id)
        .order_by(Project.name)
    )
    return list(db.scalars(stmt).all())


def list_projects_with_related(db: Session, current_user: User) -> list[Project]:
    options = [
        selectinload(Project.client),
        selectinload(Project.instances),
    ]

    if is_admin(current_user):
        options.append(selectinload(Project.assignments).selectinload(ProjectAssignment.user))
        stmt = select(Project).options(*options).order_by(Project.name)
        return list(db.scalars(stmt).all())

    stmt = (
        select(Project)
        .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
        .where(ProjectAssignment.user_id == current_user.id)
        .options(*options)
        .order_by(Project.name)
    )
    return list(db.scalars(stmt).all())


def get_project_for_user(db: Session, current_user: User, project_id: int) -> Project:
    return assert_project_access(db, current_user, project_id)


def get_project_for_user_with_related(
    db: Session,
    current_user: User,
    project_id: int,
) -> Project:
    options = [
        selectinload(Project.client),
        selectinload(Project.instances),
    ]

    if is_admin(current_user):
        options.append(selectinload(Project.assignments).selectinload(ProjectAssignment.user))
        stmt = select(Project).where(Project.id == project_id).options(*options)
    else:
        stmt = (
            select(Project)
            .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
            .where(
                Project.id == project_id,
                ProjectAssignment.user_id == current_user.id,
            )
            .options(*options)
        )

    project = db.scalar(stmt)
    if project is None:
        if is_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )

    return project


def create_project(db: Session, payload: ProjectCreate) -> Project:
    client = db.get(Client, payload.client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    existing = db.scalar(
        select(Project).where(
            Project.client_id == payload.client_id,
            Project.name == payload.name.strip(),
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A project with this name already exists for this client.",
        )

    project = Project(
        client_id=payload.client_id,
        name=payload.name.strip(),
        description=payload.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session,
    current_user: User,
    project_id: int,
    payload: ProjectUpdate,
) -> Project:
    project = assert_project_access(db, current_user, project_id)
    admin = is_admin(current_user)

    if payload.client_id is not None and not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can move a project to another client.",
        )

    target_client_id = payload.client_id if payload.client_id is not None else project.client_id
    target_name = payload.name.strip() if payload.name is not None else project.name

    if payload.client_id is not None:
        client = db.get(Client, payload.client_id)
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target client not found.",
            )

    existing = db.scalar(
        select(Project).where(
            Project.client_id == target_client_id,
            Project.name == target_name,
            Project.id != project_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A project with this name already exists for this client.",
        )

    if payload.client_id is not None:
        project.client_id = payload.client_id
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description

    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> None:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    db.delete(project)
    db.commit()
