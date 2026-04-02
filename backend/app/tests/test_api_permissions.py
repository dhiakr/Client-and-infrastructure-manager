from fastapi.testclient import TestClient

from app.models.enums import InstanceStatus, InstanceType, UserRole


def test_standard_user_is_isolated_to_assigned_projects(
    client: TestClient,
    auth_headers,
    factory,
):
    admin = factory.user(
        name="Admin Reviewer",
        email="admin.permissions@example.com",
        role=UserRole.ADMIN,
    )
    user_a = factory.user(name="User A", email="user.a@example.com")
    user_b = factory.user(name="User B", email="user.b@example.com")
    shared_client = factory.client(name="Shared Client")
    project_x = factory.project(client=shared_client, name="Project X")
    project_y = factory.project(client=shared_client, name="Project Y")

    factory.assignment(user=user_a, project=project_x)
    factory.assignment(user=user_b, project=project_y)
    factory.instance(
        project=project_y,
        name="Project Y Production",
        type=InstanceType.PRODUCTION,
        status=InstanceStatus.ACTIVE,
        url="https://project-y.example.com",
    )

    user_headers = auth_headers(user_a.email)

    list_response = client.get("/api/projects", headers=user_headers)
    assert list_response.status_code == 200, list_response.text
    assert [project["id"] for project in list_response.json()] == [project_x.id]
    assert list_response.json()[0]["instances"] == []
    assert list_response.json()[0]["assignments"] == []

    own_project_response = client.get(f"/api/projects/{project_x.id}", headers=user_headers)
    assert own_project_response.status_code == 200, own_project_response.text
    assert own_project_response.json()["name"] == "Project X"
    assert own_project_response.json()["client"]["name"] == shared_client.name
    assert own_project_response.json()["assignments"] == []

    other_project_response = client.get(f"/api/projects/{project_y.id}", headers=user_headers)
    assert other_project_response.status_code == 403, other_project_response.text
    assert (
        other_project_response.json()["detail"]
        == "You do not have access to this project."
    )

    other_instances_response = client.get(
        f"/api/projects/{project_y.id}/instances",
        headers=user_headers,
    )
    assert other_instances_response.status_code == 403, other_instances_response.text
    assert (
        other_instances_response.json()["detail"]
        == "You do not have access to this project."
    )

    admin_response = client.get("/api/projects", headers=auth_headers(admin.email))
    assert admin_response.status_code == 200, admin_response.text
    assert sorted(project["id"] for project in admin_response.json()) == sorted(
        [project_x.id, project_y.id]
    )
    project_y_payload = next(
        project for project in admin_response.json() if project["id"] == project_y.id
    )
    assert [instance["name"] for instance in project_y_payload["instances"]] == [
        "Project Y Production"
    ]
    assert [assignment["user"]["email"] for assignment in project_y_payload["assignments"]] == [
        "user.b@example.com"
    ]


def test_standard_user_can_update_assigned_project_metadata_but_cannot_move_clients(
    client: TestClient,
    auth_headers,
    db_session,
    factory,
):
    assigned_user = factory.user(
        name="Assigned User",
        email="assigned.user@example.com",
    )
    home_client = factory.client(name="Home Client")
    target_client = factory.client(name="Target Client")
    project = factory.project(
        client=home_client,
        name="Original Project",
        description="Original project description.",
    )
    factory.assignment(user=assigned_user, project=project)
    headers = auth_headers(assigned_user.email)

    update_response = client.put(
        f"/api/projects/{project.id}",
        headers=headers,
        json={
            "name": "Updated Project",
            "description": "Updated project description.",
        },
    )

    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["name"] == "Updated Project"
    assert update_response.json()["description"] == "Updated project description."
    assert update_response.json()["client_id"] == home_client.id

    db_session.refresh(project)
    assert project.name == "Updated Project"
    assert project.description == "Updated project description."
    assert project.client_id == home_client.id

    move_response = client.put(
        f"/api/projects/{project.id}",
        headers=headers,
        json={"client_id": target_client.id},
    )

    assert move_response.status_code == 403, move_response.text
    assert (
        move_response.json()["detail"]
        == "Only admins can move a project to another client."
    )

    db_session.refresh(project)
    assert project.client_id == home_client.id


def test_unassigned_standard_user_cannot_update_project_metadata(
    client: TestClient,
    auth_headers,
    factory,
):
    assigned_user = factory.user(
        name="Assigned User",
        email="assigned.editor@example.com",
    )
    unassigned_user = factory.user(
        name="Unassigned User",
        email="unassigned.editor@example.com",
    )
    workspace_client = factory.client(name="Edit Scope Client")
    project = factory.project(client=workspace_client, name="Scoped Project")
    factory.assignment(user=assigned_user, project=project)

    response = client.put(
        f"/api/projects/{project.id}",
        headers=auth_headers(unassigned_user.email),
        json={"name": "Attempted Update"},
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "You do not have access to this project."


def test_assignment_routes_hide_admins_and_reject_admin_assignment_creation(
    client: TestClient,
    auth_headers,
    factory,
):
    admin_operator = factory.user(
        name="Admin Operator",
        email="admin.operator@example.com",
        role=UserRole.ADMIN,
    )
    admin_subject = factory.user(
        name="Admin Subject",
        email="admin.subject@example.com",
        role=UserRole.ADMIN,
    )
    standard_user = factory.user(
        name="Assigned Standard User",
        email="assigned.standard@example.com",
    )
    workspace_client = factory.client(name="Assignment Client")
    project = factory.project(client=workspace_client, name="Assignment Project")
    second_project = factory.project(client=workspace_client, name="Second Assignment Project")

    factory.assignment(user=admin_subject, project=project)
    factory.assignment(user=standard_user, project=project)

    assignments_response = client.get(
        f"/api/projects/{project.id}/assignments",
        headers=auth_headers(admin_operator.email),
    )

    assert assignments_response.status_code == 200, assignments_response.text
    assert [assignment["user"]["email"] for assignment in assignments_response.json()] == [
        "assigned.standard@example.com"
    ]

    bundled_response = client.get("/api/projects", headers=auth_headers(admin_operator.email))
    assert bundled_response.status_code == 200, bundled_response.text
    bundled_project = next(
        item for item in bundled_response.json() if item["id"] == project.id
    )
    assert [assignment["user"]["email"] for assignment in bundled_project["assignments"]] == [
        "assigned.standard@example.com"
    ]

    create_response = client.post(
        f"/api/projects/{second_project.id}/assignments",
        headers=auth_headers(admin_operator.email),
        json={"user_id": admin_subject.id},
    )

    assert create_response.status_code == 400, create_response.text
    assert create_response.json()["detail"] == "Admins already have access to every project."
