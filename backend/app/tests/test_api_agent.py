from sqlalchemy import select

from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.enums import InstanceType, UserRole
from app.models.instance import OdooInstance
from app.models.project import Project
from app.schemas.agent import AgentAction, AgentPlan


def test_agent_plan_mode_returns_plan_without_writes(
    client,
    auth_headers,
    db_session,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.plan.admin@example.com",
        role=UserRole.ADMIN,
    )

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create Alpha client and a project.",
            actions=[
                AgentAction(
                    action="ensure_client",
                    alias="alpha_client",
                    params={"name": "Alpha"},
                ),
                AgentAction(
                    action="create_project",
                    alias="alpha_project",
                    params={
                        "name": "Alpha ERP",
                        "client_ref": "alpha_client",
                    },
                ),
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Create Alpha client and project", "mode": "plan"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "planned"
    assert payload["plan"]["summary"] == "Create Alpha client and a project."
    assert db_session.scalar(select(Client).where(Client.name == "Alpha")) is None


def test_agent_execute_mode_runs_create_workflow(
    client,
    auth_headers,
    db_session,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.execute.admin@example.com",
        role=UserRole.ADMIN,
    )
    assignee = factory.user(
        name="User B",
        email="user.b.agent@example.com",
    )

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create Alpha client, project, instances, and assignment.",
            actions=[
                AgentAction(
                    action="ensure_client",
                    alias="alpha_client",
                    params={"name": "Alpha"},
                ),
                AgentAction(
                    action="create_project",
                    alias="alpha_project",
                    params={
                        "name": "Alpha ERP",
                        "description": "AI-created project",
                        "client_ref": "alpha_client",
                    },
                ),
                AgentAction(
                    action="create_instance",
                    alias="alpha_dev",
                    params={
                        "project_ref": "alpha_project",
                        "name": "Alpha ERP Dev",
                        "type": "development",
                        "status": "active",
                    },
                ),
                AgentAction(
                    action="create_instance",
                    alias="alpha_staging",
                    params={
                        "project_ref": "alpha_project",
                        "name": "Alpha ERP Staging",
                        "type": "staging",
                        "status": "active",
                    },
                ),
                AgentAction(
                    action="search_users",
                    alias="assignee",
                    params={"query": "User B"},
                ),
                AgentAction(
                    action="create_assignment",
                    params={
                        "project_ref": "alpha_project",
                        "user_ref": "assignee",
                    },
                ),
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Create Alpha stack", "mode": "execute"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "executed"
    assert len(payload["results"]) == 6

    created_client = db_session.scalar(select(Client).where(Client.name == "Alpha"))
    assert created_client is not None

    created_project = db_session.scalar(select(Project).where(Project.name == "Alpha ERP"))
    assert created_project is not None
    assert created_project.client_id == created_client.id

    created_instances = list(
        db_session.scalars(
            select(OdooInstance).where(OdooInstance.project_id == created_project.id)
        ).all()
    )
    assert sorted(instance.name for instance in created_instances) == [
        "Alpha ERP Dev",
        "Alpha ERP Staging",
    ]

    created_assignment = db_session.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == created_project.id,
            ProjectAssignment.user_id == assignee.id,
        )
    )
    assert created_assignment is not None


def test_agent_execute_mode_requires_confirmation_for_destructive_plan(
    client,
    auth_headers,
    db_session,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.confirm.admin@example.com",
        role=UserRole.ADMIN,
    )
    workspace_client = factory.client(name="Delete Target Client")
    project = factory.project(client=workspace_client, name="Delete Target Project")

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Delete a project.",
            actions=[
                AgentAction(
                    action="delete_project",
                    params={"project_name": "Delete Target Project"},
                )
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    preview_response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Delete target project", "mode": "execute"},
    )

    assert preview_response.status_code == 200, preview_response.text
    assert preview_response.json()["status"] == "requires_confirmation"
    assert db_session.get(Project, project.id) is not None

    confirm_response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={
            "message": "Delete target project",
            "mode": "execute",
            "confirmed": True,
        },
    )

    assert confirm_response.status_code == 200, confirm_response.text
    assert confirm_response.json()["status"] == "executed"
    assert db_session.get(Project, project.id) is None


def test_agent_respects_backend_permissions_for_execution(
    client,
    auth_headers,
    factory,
    monkeypatch,
):
    standard_user = factory.user(
        name="Scoped User",
        email="agent.standard.user@example.com",
    )
    workspace_client = factory.client(name="Scoped Client")

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create a project.",
            actions=[
                AgentAction(
                    action="create_project",
                    params={
                        "name": "Blocked Project",
                        "client_name": workspace_client.name,
                    },
                )
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(standard_user.email),
        json={"message": "Create blocked project", "mode": "execute"},
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "This agent action requires admin access."


def test_agent_execute_mode_tolerates_search_miss_and_name_based_refs(
    client,
    auth_headers,
    db_session,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.name.refs@example.com",
        role=UserRole.ADMIN,
    )
    assignee = factory.user(
        name="User B",
        email="user.b.name.refs@example.com",
    )

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create Alpha project bundle.",
            notes=["Please review the created resources for accuracy."],
            actions=[
                AgentAction(
                    action="create_client",
                    params={"name": "Alpha"},
                ),
                AgentAction(
                    action="search_projects",
                    params={"query": "Alpha ERP"},
                ),
                AgentAction(
                    action="create_project",
                    params={
                        "name": "Alpha ERP",
                        "client_ref": "Alpha",
                    },
                ),
                AgentAction(
                    action="search_users",
                    params={"query": "User B"},
                ),
                AgentAction(
                    action="create_assignment",
                    params={
                        "project_ref": "Alpha ERP",
                        "user_ref": "User B",
                    },
                ),
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Create Alpha stack", "mode": "execute"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "executed"
    assert any(
        result["message"] == "No project matched 'Alpha ERP'."
        for result in payload["results"]
    )

    created_client = db_session.scalar(select(Client).where(Client.name == "Alpha"))
    assert created_client is not None

    created_project = db_session.scalar(select(Project).where(Project.name == "Alpha ERP"))
    assert created_project is not None
    assert created_project.client_id == created_client.id

    created_assignment = db_session.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.project_id == created_project.id,
            ProjectAssignment.user_id == assignee.id,
        )
    )
    assert created_assignment is not None


def test_agent_execute_mode_normalizes_instance_type_from_name_hint(
    client,
    auth_headers,
    db_session,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.instance.normalize@example.com",
        role=UserRole.ADMIN,
    )

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create Alpha project and dev instance.",
            actions=[
                AgentAction(
                    action="create_client",
                    alias="alpha_client",
                    params={"name": "Alpha"},
                ),
                AgentAction(
                    action="create_project",
                    alias="alpha_project",
                    params={
                        "name": "Alpha ERP",
                        "client_ref": "alpha_client",
                    },
                ),
                AgentAction(
                    action="create_instance",
                    params={
                        "project_ref": "alpha_project",
                        "name": "Alpha Dev Server",
                        "type": "server",
                        "status": "running",
                    },
                ),
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Create Alpha dev server", "mode": "execute"},
    )

    assert response.status_code == 200, response.text

    created_project = db_session.scalar(select(Project).where(Project.name == "Alpha ERP"))
    assert created_project is not None

    created_instance = db_session.scalar(
        select(OdooInstance).where(OdooInstance.project_id == created_project.id)
    )
    assert created_instance is not None
    assert created_instance.type == InstanceType.DEVELOPMENT


def test_agent_execute_mode_returns_clean_400_for_invalid_instance_type(
    client,
    auth_headers,
    factory,
    monkeypatch,
):
    admin = factory.user(
        name="Agent Admin",
        email="agent.instance.invalid@example.com",
        role=UserRole.ADMIN,
    )

    def fake_plan(current_user, message):
        return AgentPlan(
            summary="Create Alpha project and invalid instance.",
            actions=[
                AgentAction(
                    action="create_client",
                    alias="alpha_client",
                    params={"name": "Alpha"},
                ),
                AgentAction(
                    action="create_project",
                    alias="alpha_project",
                    params={
                        "name": "Alpha ERP",
                        "client_ref": "alpha_client",
                    },
                ),
                AgentAction(
                    action="create_instance",
                    params={
                        "project_ref": "alpha_project",
                        "name": "Alpha Mystery Box",
                        "type": "banana",
                    },
                ),
            ],
        )

    monkeypatch.setattr("app.services.agent_service.plan_agent_message", fake_plan)

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(admin.email),
        json={"message": "Create Alpha invalid instance", "mode": "execute"},
    )

    assert response.status_code == 400, response.text
    assert (
        response.json()["detail"]
        == "Agent action 'create_instance' has an invalid 'type' value: Input should be "
        "'production', 'staging' or 'development'"
    )
