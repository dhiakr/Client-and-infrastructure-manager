from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.instance import InstanceCreate, InstanceResponse, InstanceUpdate
from app.services.instance_service import (
    create_instance,
    delete_instance,
    get_instance_for_user,
    list_instances_for_project,
    update_instance,
)

router = APIRouter(tags=["instances"])


@router.get("/projects/{project_id}/instances", response_model=list[InstanceResponse])
def get_project_instances(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InstanceResponse]:
    instances = list_instances_for_project(db, current_user, project_id)
    return [InstanceResponse.model_validate(instance) for instance in instances]


@router.post(
    "/projects/{project_id}/instances",
    response_model=InstanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_instance_route(
    project_id: int,
    payload: InstanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstanceResponse:
    instance = create_instance(db, current_user, project_id, payload)
    return InstanceResponse.model_validate(instance)


@router.get("/instances/{instance_id}", response_model=InstanceResponse)
def get_instance(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstanceResponse:
    instance = get_instance_for_user(db, current_user, instance_id)
    return InstanceResponse.model_validate(instance)


@router.put("/instances/{instance_id}", response_model=InstanceResponse)
def update_instance_route(
    instance_id: int,
    payload: InstanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstanceResponse:
    instance = update_instance(db, current_user, instance_id, payload)
    return InstanceResponse.model_validate(instance)


@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instance_route(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    delete_instance(db, current_user, instance_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)