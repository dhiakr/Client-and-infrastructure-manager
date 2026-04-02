from fastapi.testclient import TestClient

from app.models.enums import UserRole


def test_project_allows_only_one_active_production_instance(
    client: TestClient,
    auth_headers,
    factory,
):
    admin = factory.user(
        name="Admin Operator",
        email="admin.instances@example.com",
        role=UserRole.ADMIN,
    )
    workspace_client = factory.client(name="Instance Test Client")
    project = factory.project(
        client=workspace_client,
        name="Production Guardrails",
        description="Validate production instance rules.",
    )
    headers = auth_headers(admin.email)

    first_response = client.post(
        f"/api/projects/{project.id}/instances",
        headers=headers,
        json={
            "name": "Primary Production",
            "type": "production",
            "status": "active",
            "url": "https://prod-1.example.com",
        },
    )

    assert first_response.status_code == 201, first_response.text
    assert first_response.json()["type"] == "production"
    assert first_response.json()["status"] == "active"

    duplicate_response = client.post(
        f"/api/projects/{project.id}/instances",
        headers=headers,
        json={
            "name": "Secondary Production",
            "type": "production",
            "status": "active",
            "url": "https://prod-2.example.com",
        },
    )

    assert duplicate_response.status_code == 400, duplicate_response.text
    assert (
        duplicate_response.json()["detail"]
        == "This project already has an active production instance."
    )

    staging_response = client.post(
        f"/api/projects/{project.id}/instances",
        headers=headers,
        json={
            "name": "Staging Environment",
            "type": "staging",
            "status": "active",
            "url": "https://staging.example.com",
        },
    )

    assert staging_response.status_code == 201, staging_response.text

    update_response = client.put(
        f"/api/instances/{staging_response.json()['id']}",
        headers=headers,
        json={
            "type": "production",
            "status": "active",
        },
    )

    assert update_response.status_code == 400, update_response.text
    assert (
        update_response.json()["detail"]
        == "This project already has an active production instance."
    )
