from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import InstanceStatus, InstanceType
from app.models.instance import OdooInstance
from app.models.user import User
from app.schemas.instance import InstanceCreate, InstanceUpdate
from app.services.permission_service import assert_project_access


def _validate_single_active_production(
    db: Session,
    project_id: int,
    instance_type: InstanceType,
    instance_status: InstanceStatus,
    current_instance_id: int | None = None,
) -> None:
    if not (
        instance_type == InstanceType.PRODUCTION
        and instance_status == InstanceStatus.ACTIVE
    ):
        return

    stmt = select(OdooInstance).where(
        OdooInstance.project_id == project_id,
        OdooInstance.type == InstanceType.PRODUCTION,
        OdooInstance.status == InstanceStatus.ACTIVE,
    )

    if current_instance_id is not None:
        stmt = stmt.where(OdooInstance.id != current_instance_id)

    existing = db.scalar(stmt.limit(1))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This project already has an active production instance.",
        )


def list_instances_for_project(
    db: Session,
    current_user: User,
    project_id: int,
) -> list[OdooInstance]:
    assert_project_access(db, current_user, project_id)

    stmt = (
        select(OdooInstance)
        .where(OdooInstance.project_id == project_id)
        .order_by(OdooInstance.name)
    )
    return list(db.scalars(stmt).all())


def get_instance_for_user(
    db: Session,
    current_user: User,
    instance_id: int,
) -> OdooInstance:
    instance = db.get(OdooInstance, instance_id)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instance not found.",
        )

    assert_project_access(db, current_user, instance.project_id)
    return instance


def create_instance(
    db: Session,
    current_user: User,
    project_id: int,
    payload: InstanceCreate,
) -> OdooInstance:
    assert_project_access(db, current_user, project_id)

    _validate_single_active_production(
        db=db,
        project_id=project_id,
        instance_type=payload.type,
        instance_status=payload.status,
    )

    instance = OdooInstance(
        project_id=project_id,
        name=payload.name.strip(),
        type=payload.type,
        status=payload.status,
        url=payload.url,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def update_instance(
    db: Session,
    current_user: User,
    instance_id: int,
    payload: InstanceUpdate,
) -> OdooInstance:
    instance = get_instance_for_user(db, current_user, instance_id)

    target_type = payload.type if payload.type is not None else instance.type
    target_status = payload.status if payload.status is not None else instance.status

    _validate_single_active_production(
        db=db,
        project_id=instance.project_id,
        instance_type=target_type,
        instance_status=target_status,
        current_instance_id=instance.id,
    )

    if payload.name is not None:
        instance.name = payload.name.strip()
    if payload.type is not None:
        instance.type = payload.type
    if payload.status is not None:
        instance.status = payload.status
    if payload.url is not None:
        instance.url = payload.url

    db.commit()
    db.refresh(instance)
    return instance


def delete_instance(
    db: Session,
    current_user: User,
    instance_id: int,
) -> None:
    instance = get_instance_for_user(db, current_user, instance_id)
    db.delete(instance)
    db.commit()