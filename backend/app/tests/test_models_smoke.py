from app.core.database import SessionLocal
from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.enums import InstanceStatus, InstanceType, UserRole
from app.models.instance import OdooInstance
from app.models.project import Project
from app.models.user import User


def test_model_creation_flow():
    db = SessionLocal()

    try:
        client = Client(name="Client Smoke")
        db.add(client)
        db.flush()

        project = Project(
            name="Project Smoke",
            description="Smoke test project",
            client_id=client.id,
        )
        db.add(project)
        db.flush()

        user = User(
            name="Smoke User",
            email="smoke@example.com",
            password_hash="hashed",
            role=UserRole.STANDARD,
        )
        db.add(user)
        db.flush()

        assignment = ProjectAssignment(user_id=user.id, project_id=project.id)
        db.add(assignment)

        instance = OdooInstance(
            project_id=project.id,
            name="Smoke Instance",
            type=InstanceType.STAGING,
            status=InstanceStatus.ACTIVE,
            url="https://staging.example.com",
        )
        db.add(instance)

        db.commit()

        assert client.id is not None
        assert project.id is not None
        assert user.id is not None
        assert assignment.id is not None
        assert instance.id is not None

    finally:
        db.close()
