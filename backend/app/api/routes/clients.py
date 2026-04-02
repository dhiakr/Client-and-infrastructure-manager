from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.services.client_service import (
    create_client,
    delete_client,
    get_client_for_user,
    list_clients,
    update_client,
)

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientResponse])
def get_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ClientResponse]:
    clients = list_clients(db, current_user)
    return [ClientResponse.model_validate(client) for client in clients]


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientResponse:
    client = get_client_for_user(db, current_user, client_id)
    return ClientResponse.model_validate(client)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client_route(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ClientResponse:
    client = create_client(db, payload)
    return ClientResponse.model_validate(client)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client_route(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ClientResponse:
    client = update_client(db, client_id, payload)
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_route(
    client_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    delete_client(db, client_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)