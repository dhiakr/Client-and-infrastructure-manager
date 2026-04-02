from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.project import Project
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.permission_service import assert_client_access, is_admin


def list_clients(db: Session, current_user: User) -> list[Client]:
    if is_admin(current_user):
        stmt = select(Client).order_by(Client.name)
        return list(db.scalars(stmt).all())

    stmt = (
        select(Client)
        .join(Project, Project.client_id == Client.id)
        .join(ProjectAssignment, ProjectAssignment.project_id == Project.id)
        .where(ProjectAssignment.user_id == current_user.id)
        .distinct()
        .order_by(Client.name)
    )
    return list(db.scalars(stmt).all())


def get_client_for_user(db: Session, current_user: User, client_id: int) -> Client:
    return assert_client_access(db, current_user, client_id)


def create_client(db: Session, payload: ClientCreate) -> Client:
    existing = db.scalar(select(Client).where(Client.name == payload.name.strip()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A client with this name already exists.",
        )

    client = Client(name=payload.name.strip())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client_id: int, payload: ClientUpdate) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    if payload.name is not None:
        clean_name = payload.name.strip()
        existing = db.scalar(
            select(Client).where(Client.name == clean_name, Client.id != client_id)
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A client with this name already exists.",
            )
        client.name = clean_name

    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client_id: int) -> None:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found.",
        )

    db.delete(client)
    db.commit()