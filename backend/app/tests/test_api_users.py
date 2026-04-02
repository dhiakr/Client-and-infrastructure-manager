from fastapi.testclient import TestClient

from app.models.enums import UserRole


def test_user_directory_route_is_admin_only_and_searchable(
    client: TestClient,
    auth_headers,
    factory,
):
    admin = factory.user(
        name="Admin Directory",
        email="admin.directory@example.com",
        role=UserRole.ADMIN,
    )
    standard_user = factory.user(
        name="Standard Viewer",
        email="standard.viewer@example.com",
    )
    factory.user(name="Alice Assignment", email="alice.assignment@example.com")
    factory.user(name="Bob Builder", email="bob.builder@example.com")

    all_users_response = client.get(
        "/api/users",
        headers=auth_headers(admin.email),
    )

    assert all_users_response.status_code == 200, all_users_response.text
    assert {user["email"] for user in all_users_response.json()} == {
        "alice.assignment@example.com",
        "bob.builder@example.com",
        "standard.viewer@example.com",
    }

    admin_response = client.get(
        "/api/users?query=alice&limit=10",
        headers=auth_headers(admin.email),
    )

    assert admin_response.status_code == 200, admin_response.text
    assert [user["email"] for user in admin_response.json()] == [
        "alice.assignment@example.com"
    ]

    standard_response = client.get(
        "/api/users",
        headers=auth_headers(standard_user.email),
    )

    assert standard_response.status_code == 403, standard_response.text
    assert standard_response.json()["detail"] == "Admin access required."
