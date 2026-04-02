from collections.abc import Iterable

from fastapi import HTTPException, status
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.enums import InstanceStatus, InstanceType
from app.models.instance import OdooInstance
from app.models.project import Project
from app.models.user import User
from app.schemas.agent import AgentAction, AgentActionResult, AgentReference
from app.schemas.client import ClientCreate, ClientUpdate
from app.schemas.instance import InstanceCreate, InstanceUpdate
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.assignment_service import create_assignment, delete_assignment
from app.services.client_service import create_client, delete_client, list_clients, update_client
from app.services.instance_service import (
    create_instance,
    delete_instance,
    get_instance_for_user,
    list_instances_for_project,
    update_instance,
)
from app.services.permission_service import is_admin
from app.services.project_service import (
    create_project,
    delete_project,
    list_projects,
    update_project,
)
from app.services.user_service import list_users

DESTRUCTIVE_AGENT_ACTIONS = {
    "delete_client",
    "delete_project",
    "delete_instance",
    "delete_assignment",
}


def plan_requires_confirmation(actions: Iterable[AgentAction], explicit_flag: bool = False) -> bool:
    if explicit_flag:
        return True

    for action in actions:
        if action.action in DESTRUCTIVE_AGENT_ACTIONS:
            return True

        if action.action == "update_project" and any(
            key in action.params for key in ("client_id", "client_name", "client_ref")
        ):
            return True

    return False


def execute_agent_actions(
    db: Session,
    current_user: User,
    actions: list[AgentAction],
) -> list[AgentActionResult]:
    references: dict[str, AgentReference] = {}
    results: list[AgentActionResult] = []

    for action in actions:
        result = _execute_agent_action(db, current_user, action, references)
        if action.alias and result.reference is not None:
            references[action.alias] = result.reference
        results.append(result)

    return results


def _execute_agent_action(
    db: Session,
    current_user: User,
    action: AgentAction,
    references: dict[str, AgentReference],
) -> AgentActionResult:
    params = action.params

    if action.action == "search_clients":
        client = _try_search_entity(
            lambda: _resolve_client(
                db,
                current_user,
                params,
                references,
                require_lookup_only=True,
            ),
        )
        if client is None:
            return AgentActionResult(
                action=action.action,
                alias=action.alias,
                status="resolved",
                message=f"No client matched '{params.get('query') or params.get('client_name')}'.",
            )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="found",
            message=f"Found client {client.name}.",
            reference=AgentReference(kind="client", id=client.id, name=client.name),
        )

    if action.action == "ensure_client":
        _require_admin(current_user)
        name = _required_text(params, "name")
        existing = _find_exact_client_by_name(db, name)
        if existing is not None:
            return AgentActionResult(
                action=action.action,
                alias=action.alias,
                status="resolved",
                message=f"Client {existing.name} already exists.",
                reference=AgentReference(kind="client", id=existing.id, name=existing.name),
            )

        client = create_client(
            db,
            _build_payload(
                ClientCreate,
                {"name": name},
                action_name=action.action,
            ),
        )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="created",
            message=f"Created client {client.name}.",
            reference=AgentReference(kind="client", id=client.id, name=client.name),
        )

    if action.action == "create_client":
        _require_admin(current_user)
        name = _required_text(params, "name")
        client = create_client(
            db,
            _build_payload(
                ClientCreate,
                {"name": name},
                action_name=action.action,
            ),
        )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="created",
            message=f"Created client {client.name}.",
            reference=AgentReference(kind="client", id=client.id, name=client.name),
        )

    if action.action == "update_client":
        _require_admin(current_user)
        client = _resolve_client(db, current_user, params, references)
        payload = _build_payload(
            ClientUpdate,
            {"name": _optional_text(params, "name")},
            action_name=action.action,
        )
        if payload.name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="update_client requires at least one editable field.",
            )
        updated = update_client(db, client.id, payload)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="updated",
            message=f"Updated client {updated.name}.",
            reference=AgentReference(kind="client", id=updated.id, name=updated.name),
        )

    if action.action == "delete_client":
        _require_admin(current_user)
        client = _resolve_client(db, current_user, params, references)
        reference = AgentReference(kind="client", id=client.id, name=client.name)
        delete_client(db, client.id)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="deleted",
            message=f"Deleted client {reference.name}.",
            reference=reference,
        )

    if action.action == "search_projects":
        project = _try_search_entity(
            lambda: _resolve_project(
                db,
                current_user,
                params,
                references,
                require_lookup_only=True,
            ),
        )
        if project is None:
            return AgentActionResult(
                action=action.action,
                alias=action.alias,
                status="resolved",
                message=(
                    f"No project matched '{params.get('query') or params.get('project_name')}'."
                ),
            )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="found",
            message=f"Found project {project.name}.",
            reference=AgentReference(
                kind="project",
                id=project.id,
                name=project.name,
                extra={"client_id": project.client_id},
            ),
        )

    if action.action == "create_project":
        _require_admin(current_user)
        client = _resolve_client(db, current_user, params, references)
        payload = _build_payload(
            ProjectCreate,
            {
                "client_id": client.id,
                "name": _required_text(params, "name"),
                "description": _optional_text(params, "description"),
            },
            action_name=action.action,
        )
        project = create_project(db, payload)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="created",
            message=f"Created project {project.name}.",
            reference=AgentReference(
                kind="project",
                id=project.id,
                name=project.name,
                extra={"client_id": project.client_id},
            ),
        )

    if action.action == "update_project":
        project = _resolve_project(db, current_user, params, references)
        target_client = None
        if any(key in params for key in ("client_id", "client_name", "client_ref")):
            target_client = _resolve_client(db, current_user, params, references)

        if not any(
            key in params
            for key in ("name", "description", "client_id", "client_name", "client_ref")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="update_project requires at least one editable field.",
            )

        updated = update_project(
            db,
            current_user,
            project.id,
            _build_payload(
                ProjectUpdate,
                {
                    "client_id": target_client.id if target_client is not None else None,
                    "name": _optional_text(params, "name"),
                    "description": _optional_nullable_text(params, "description"),
                },
                action_name=action.action,
            ),
        )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="updated",
            message=f"Updated project {updated.name}.",
            reference=AgentReference(
                kind="project",
                id=updated.id,
                name=updated.name,
                extra={"client_id": updated.client_id},
            ),
        )

    if action.action == "delete_project":
        _require_admin(current_user)
        project = _resolve_project(db, current_user, params, references)
        reference = AgentReference(
            kind="project",
            id=project.id,
            name=project.name,
            extra={"client_id": project.client_id},
        )
        delete_project(db, project.id)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="deleted",
            message=f"Deleted project {reference.name}.",
            reference=reference,
        )

    if action.action == "search_instances":
        instance = _try_search_entity(
            lambda: _resolve_instance(
                db,
                current_user,
                params,
                references,
                require_lookup_only=True,
            ),
        )
        if instance is None:
            return AgentActionResult(
                action=action.action,
                alias=action.alias,
                status="resolved",
                message=(
                    f"No instance matched '{params.get('query') or params.get('instance_name')}'."
                ),
            )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="found",
            message=f"Found instance {instance.name}.",
            reference=AgentReference(
                kind="instance",
                id=instance.id,
                name=instance.name,
                extra={"project_id": instance.project_id},
            ),
        )

    if action.action == "create_instance":
        project = _resolve_project(db, current_user, params, references)
        instance_name = _required_text(params, "name")
        payload = _build_payload(
            InstanceCreate,
            {
                "name": instance_name,
                "type": _normalize_instance_type(
                    _required_text(params, "type"),
                    instance_name=instance_name,
                ),
                "status": _normalize_instance_status(_optional_text(params, "status"))
                or InstanceStatus.ACTIVE.value,
                "url": _optional_nullable_text(params, "url"),
            },
            action_name=action.action,
        )
        instance = create_instance(db, current_user, project.id, payload)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="created",
            message=f"Created instance {instance.name}.",
            reference=AgentReference(
                kind="instance",
                id=instance.id,
                name=instance.name,
                extra={"project_id": instance.project_id},
            ),
        )

    if action.action == "update_instance":
        instance = _resolve_instance(db, current_user, params, references)
        payload = _build_payload(
            InstanceUpdate,
            {
                "name": _optional_text(params, "name"),
                "type": _normalize_instance_type(
                    _optional_text(params, "type"),
                    instance_name=_optional_text(params, "name") or instance.name,
                ),
                "status": _normalize_instance_status(_optional_text(params, "status")),
                "url": _optional_nullable_text(params, "url"),
            },
            action_name=action.action,
        )
        if not any(key in params for key in ("name", "type", "status", "url")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="update_instance requires at least one editable field.",
            )
        updated = update_instance(db, current_user, instance.id, payload)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="updated",
            message=f"Updated instance {updated.name}.",
            reference=AgentReference(
                kind="instance",
                id=updated.id,
                name=updated.name,
                extra={"project_id": updated.project_id},
            ),
        )

    if action.action == "delete_instance":
        instance = _resolve_instance(db, current_user, params, references)
        reference = AgentReference(
            kind="instance",
            id=instance.id,
            name=instance.name,
            extra={"project_id": instance.project_id},
        )
        delete_instance(db, current_user, instance.id)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="deleted",
            message=f"Deleted instance {reference.name}.",
            reference=reference,
        )

    if action.action == "search_users":
        _require_admin(current_user)
        user = _try_search_entity(
            lambda: _resolve_user(
                db,
                current_user,
                params,
                references,
                require_lookup_only=True,
            ),
        )
        if user is None:
            return AgentActionResult(
                action=action.action,
                alias=action.alias,
                status="resolved",
                message=f"No user matched '{params.get('query') or params.get('user_query')}'.",
            )
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="found",
            message=f"Found user {user.name}.",
            reference=AgentReference(
                kind="user",
                id=user.id,
                name=user.name,
                extra={"email": user.email},
            ),
        )

    if action.action == "create_assignment":
        _require_admin(current_user)
        project = _resolve_project(db, current_user, params, references)
        user = _resolve_user(db, current_user, params, references)
        assignment = create_assignment(db, project.id, user.id)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="assigned",
            message=f"Assigned {assignment.user.name} to {project.name}.",
            reference=AgentReference(
                kind="assignment",
                id=assignment.id,
                name=f"{assignment.user.name} -> {project.name}",
                extra={"project_id": project.id, "user_id": assignment.user.id},
            ),
        )

    if action.action == "delete_assignment":
        _require_admin(current_user)
        project = _resolve_project(db, current_user, params, references)
        user = _resolve_user(db, current_user, params, references)
        delete_assignment(db, project.id, user.id)
        return AgentActionResult(
            action=action.action,
            alias=action.alias,
            status="removed",
            message=f"Removed {user.name} from {project.name}.",
            reference=AgentReference(
                kind="assignment",
                name=f"{user.name} -> {project.name}",
                extra={"project_id": project.id, "user_id": user.id},
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported agent action: {action.action}.",
    )


def _require_admin(current_user: User) -> None:
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This agent action requires admin access.",
        )


def _resolve_client(
    db: Session,
    current_user: User,
    params: dict[str, object],
    references: dict[str, AgentReference],
    *,
    require_lookup_only: bool = False,
) -> Client:
    fallback_query: str | None = None

    if client_ref := _optional_text(params, "client_ref"):
        reference = _find_reference(references, client_ref, "client")
        if reference is not None:
            client = db.get(Client, reference.id)
            if client is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Client not found.",
                )
            return client
        fallback_query = client_ref

    if client_id := _optional_int(params, "client_id"):
        client = db.get(Client, client_id)
        if client is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
        if not is_admin(current_user):
            accessible = {item.id for item in list_clients(db, current_user)}
            if client.id not in accessible:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this client.",
                )
        return client

    query = (
        fallback_query
        or _optional_text(params, "client_name")
        or _optional_text(params, "query")
    )
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client resolution requires client_ref, client_id, client_name, or query.",
        )

    if is_admin(current_user):
        clients = list(db.scalars(select(Client).order_by(Client.name)).all())
    else:
        clients = list_clients(db, current_user)

    return _pick_unique_match(
        clients,
        query,
        "client",
        lambda item: [item.name],
        require_lookup_only,
    )


def _resolve_project(
    db: Session,
    current_user: User,
    params: dict[str, object],
    references: dict[str, AgentReference],
    *,
    require_lookup_only: bool = False,
) -> Project:
    fallback_query: str | None = None

    if project_ref := _optional_text(params, "project_ref"):
        reference = _find_reference(references, project_ref, "project")
        if reference is not None:
            project = db.get(Project, reference.id)
            if project is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found.",
                )
            if not is_admin(current_user):
                accessible = {item.id for item in list_projects(db, current_user)}
                if project.id not in accessible:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have access to this project.",
                    )
            return project
        fallback_query = project_ref

    if project_id := _optional_int(params, "project_id"):
        project = db.get(Project, project_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        if not is_admin(current_user):
            accessible = {item.id for item in list_projects(db, current_user)}
            if project.id not in accessible:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this project.",
                )
        return project

    query = (
        fallback_query
        or _optional_text(params, "project_name")
        or _optional_text(params, "query")
    )
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project resolution requires project_ref, project_id, project_name, or query.",
        )

    projects = list_projects(db, current_user)
    return _pick_unique_match(
        projects,
        query,
        "project",
        lambda item: [item.name],
        require_lookup_only,
    )


def _resolve_instance(
    db: Session,
    current_user: User,
    params: dict[str, object],
    references: dict[str, AgentReference],
    *,
    require_lookup_only: bool = False,
) -> OdooInstance:
    fallback_query: str | None = None

    if instance_ref := _optional_text(params, "instance_ref"):
        reference = _find_reference(references, instance_ref, "instance")
        if reference is not None:
            if reference.id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Instance reference is incomplete.",
                )
            return get_instance_for_user(db, current_user, reference.id)
        fallback_query = instance_ref

    if instance_id := _optional_int(params, "instance_id"):
        return get_instance_for_user(db, current_user, instance_id)

    query = (
        fallback_query
        or _optional_text(params, "instance_name")
        or _optional_text(params, "query")
    )
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Instance resolution requires instance_ref, instance_id, "
                "instance_name, or query."
            ),
        )

    if project_ref := _optional_text(params, "project_ref"):
        project = _resolve_project(db, current_user, {"project_ref": project_ref}, references)
        instances = list_instances_for_project(db, current_user, project.id)
    elif project_id := _optional_int(params, "project_id"):
        instances = list_instances_for_project(db, current_user, project_id)
    elif project_name := _optional_text(params, "project_name"):
        project = _resolve_project(db, current_user, {"project_name": project_name}, references)
        instances = list_instances_for_project(db, current_user, project.id)
    else:
        instances = []
        for project in list_projects(db, current_user):
            instances.extend(list_instances_for_project(db, current_user, project.id))

    return _pick_unique_match(
        instances,
        query,
        "instance",
        lambda item: [item.name],
        require_lookup_only,
    )


def _resolve_user(
    db: Session,
    current_user: User,
    params: dict[str, object],
    references: dict[str, AgentReference],
    *,
    require_lookup_only: bool = False,
) -> User:
    _require_admin(current_user)
    fallback_query: str | None = None

    if user_ref := _optional_text(params, "user_ref"):
        reference = _find_reference(references, user_ref, "user")
        if reference is not None:
            user = db.get(User, reference.id)
            if user is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
            return user
        fallback_query = user_ref

    if user_id := _optional_int(params, "user_id"):
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    query = (
        fallback_query
        or _optional_text(params, "user_query")
        or _optional_text(params, "query")
    )
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User resolution requires user_ref, user_id, user_query, or query.",
        )

    users = list_users(db, query=query, limit=10)
    return _pick_unique_match(
        users,
        query,
        "user",
        lambda item: [item.name, item.email],
        require_lookup_only,
    )


def _pick_unique_match(
    items,
    query: str,
    label: str,
    text_getter,
    require_lookup_only: bool,
):
    clean_query = query.strip().lower()

    exact_matches = [
        item
        for item in items
        if any(text.lower() == clean_query for text in text_getter(item) if text)
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(exact_matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple {label}s match '{query}'. Please be more specific.",
        )

    partial_matches = [
        item
        for item in items
        if any(clean_query in text.lower() for text in text_getter(item) if text)
    ]
    if len(partial_matches) == 1:
        return partial_matches[0]
    if len(partial_matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple {label}s match '{query}'. Please be more specific.",
        )

    status_code = status.HTTP_404_NOT_FOUND if require_lookup_only else status.HTTP_400_BAD_REQUEST
    raise HTTPException(
        status_code=status_code,
        detail=f"No {label} matched '{query}'.",
    )


def _find_reference(
    references: dict[str, AgentReference],
    name: str,
    kind: str,
) -> AgentReference | None:
    reference = references.get(name)
    if reference is None:
        return None
    if reference.kind != kind:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reference '{name}' is not a {kind}.",
        )
    return reference


def _try_search_entity(resolver):
    try:
        return resolver()
    except HTTPException as error:
        if error.status_code == status.HTTP_404_NOT_FOUND and str(error.detail).startswith("No "):
            return None
        raise


def _find_exact_client_by_name(db: Session, name: str) -> Client | None:
    clean_name = name.strip().lower()
    clients = list(db.scalars(select(Client).order_by(Client.name)).all())
    for client in clients:
        if client.name.lower() == clean_name:
            return client
    return None


def _build_payload(model_class: type[BaseModel], data: dict[str, object], *, action_name: str):
    try:
        return model_class(**data)
    except ValidationError as error:
        first_issue = error.errors()[0]
        field_path = ".".join(str(part) for part in first_issue.get("loc", ()))
        field_label = field_path or "payload"
        message = first_issue.get("msg", "Invalid value.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent action '{action_name}' has an invalid '{field_label}' value: {message}",
        ) from error


def _normalize_instance_type(value: str | None, *, instance_name: str | None = None) -> str | None:
    if value is None:
        return None

    clean_value = value.strip().lower().replace("_", " ").replace("-", " ")
    keyword = _match_instance_type_keyword(clean_value)
    if keyword is not None:
        return keyword

    if instance_name:
        name_keyword = _match_instance_type_keyword(instance_name.strip().lower())
        if name_keyword is not None:
            return name_keyword

    return value.strip()


def _match_instance_type_keyword(text: str) -> str | None:
    if any(keyword in text for keyword in ("production", " prod", "prod ", " prod ", "live")):
        return InstanceType.PRODUCTION.value
    if any(keyword in text for keyword in ("staging", " stage", "stage ", " stage ", "uat")):
        return InstanceType.STAGING.value
    if any(keyword in text for keyword in ("development", " dev", "dev ", " dev ", "sandbox")):
        return InstanceType.DEVELOPMENT.value
    if text in {"prod", "stage", "dev"}:
        return {
            "prod": InstanceType.PRODUCTION.value,
            "stage": InstanceType.STAGING.value,
            "dev": InstanceType.DEVELOPMENT.value,
        }[text]
    return None


def _normalize_instance_status(value: str | None) -> str | None:
    if value is None:
        return None

    clean_value = value.strip().lower().replace("_", " ").replace("-", " ")
    if clean_value in {"active", "running", "enabled", "live", "up"}:
        return InstanceStatus.ACTIVE.value
    if clean_value in {"inactive", "disabled", "stopped", "paused", "down"}:
        return InstanceStatus.INACTIVE.value
    return value.strip()


def _required_text(params: dict[str, object], key: str) -> str:
    value = _optional_text(params, key)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent action requires '{key}'.",
        )
    return value


def _optional_text(params: dict[str, object], key: str) -> str | None:
    value = params.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent parameter '{key}' must be a string.",
        )
    clean_value = value.strip()
    return clean_value or None


def _optional_nullable_text(params: dict[str, object], key: str) -> str | None:
    if key not in params:
        return None

    value = params.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent parameter '{key}' must be a string or null.",
        )
    return value.strip() or None


def _optional_int(params: dict[str, object], key: str) -> int | None:
    value = params.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent parameter '{key}' must be an integer.",
        )
    return value
