# ruff: noqa: E402

import os
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

TEST_DB_PATH = Path(__file__).resolve().parent / "test_api.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key"

from app.core.database import get_db
from app.core.security import get_password_hash
from app.main import app
from app.models import Base
from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.enums import InstanceStatus, InstanceType, UserRole
from app.models.instance import OdooInstance
from app.models.project import Project
from app.models.user import User

test_engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
    future=True,
)
TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


class TestDataFactory:
    def __init__(self, db: Session):
        self.db = db

    def user(
        self,
        *,
        name: str,
        email: str,
        role: UserRole = UserRole.STANDARD,
        password: str = "password123",
    ) -> User:
        user = User(
            name=name,
            email=email,
            password_hash=get_password_hash(password),
            role=role,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def client(self, *, name: str) -> Client:
        client = Client(name=name)
        self.db.add(client)
        self.db.commit()
        self.db.refresh(client)
        return client

    def project(
        self,
        *,
        client: Client,
        name: str,
        description: str | None = None,
    ) -> Project:
        project = Project(
            client_id=client.id,
            name=name,
            description=description,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def assignment(self, *, user: User, project: Project) -> ProjectAssignment:
        assignment = ProjectAssignment(user_id=user.id, project_id=project.id)
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def instance(
        self,
        *,
        project: Project,
        name: str,
        type: InstanceType,
        status: InstanceStatus,
        url: str | None = None,
    ) -> OdooInstance:
        instance = OdooInstance(
            project_id=project.id,
            name=name,
            type=type,
            status=status,
            url=url,
        )
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def factory(db_session: Session) -> TestDataFactory:
    return TestDataFactory(db_session)


@pytest.fixture
def auth_headers(
    client: TestClient,
) -> Callable[[str, str], dict[str, str]]:
    def build_headers(email: str, password: str = "password123") -> dict[str, str]:
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )

        assert response.status_code == 200, response.text
        access_token = response.json()["access_token"]
        return {"Authorization": f"Bearer {access_token}"}

    return build_headers
