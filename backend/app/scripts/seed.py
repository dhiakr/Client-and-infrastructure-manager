from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.assignment import ProjectAssignment
from app.models.client import Client
from app.models.enums import InstanceStatus, InstanceType, UserRole
from app.models.instance import OdooInstance
from app.models.project import Project
from app.models.user import User


def upsert_user(db, name: str, email: str, password: str, role: UserRole) -> User:
    user = db.scalar(select(User).where(User.email == email))

    if user:
        user.name = name
        user.password_hash = get_password_hash(password)
        user.role = role
        db.flush()
        return user

    user = User(
        name=name,
        email=email,
        password_hash=get_password_hash(password),
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def get_or_create_client(db, name: str, aliases: tuple[str, ...] = ()) -> Client:
    client = db.scalar(select(Client).where(Client.name == name))
    if client:
        return client

    if aliases:
        client = db.scalar(select(Client).where(Client.name.in_(aliases)))
        if client:
            client.name = name
            db.flush()
            return client

    client = Client(name=name)
    db.add(client)
    db.flush()
    return client


def get_or_create_project(
    db,
    name: str,
    client_id: int,
    description: str | None = None,
    aliases: tuple[str, ...] = (),
) -> Project:
    project = db.scalar(select(Project).where(Project.name == name, Project.client_id == client_id))
    if project:
        project.description = description
        db.flush()
        return project

    if aliases:
        project = db.scalar(select(Project).where(Project.name.in_(aliases), Project.client_id == client_id))
        if project:
            project.name = name
            project.description = description
            db.flush()
            return project

    project = Project(
        name=name,
        client_id=client_id,
        description=description,
    )
    db.add(project)
    db.flush()
    return project


def get_or_create_instance(
    db,
    project_id: int,
    name: str,
    instance_type: InstanceType,
    status: InstanceStatus,
    url: str | None = None,
    aliases: tuple[str, ...] = (),
) -> OdooInstance:
    instance = db.scalar(
        select(OdooInstance).where(
            OdooInstance.project_id == project_id,
            OdooInstance.name == name,
        )
    )
    if instance:
        instance.type = instance_type
        instance.status = status
        instance.url = url
        db.flush()
        return instance

    if aliases:
        instance = db.scalar(
            select(OdooInstance).where(
                OdooInstance.project_id == project_id,
                OdooInstance.name.in_(aliases),
            )
        )
        if instance:
            instance.name = name
            instance.type = instance_type
            instance.status = status
            instance.url = url
            db.flush()
            return instance

    instance = OdooInstance(
        project_id=project_id,
        name=name,
        type=instance_type,
        status=status,
        url=url,
    )
    db.add(instance)
    db.flush()
    return instance


def get_or_create_assignment(db, user_id: int, project_id: int) -> ProjectAssignment:
    assignment = db.scalar(
        select(ProjectAssignment).where(
            ProjectAssignment.user_id == user_id,
            ProjectAssignment.project_id == project_id,
        )
    )
    if assignment:
        return assignment

    assignment = ProjectAssignment(user_id=user_id, project_id=project_id)
    db.add(assignment)
    db.flush()
    return assignment


def seed() -> None:
    db = SessionLocal()

    try:
        upsert_user(
            db=db,
            name="Captain Marvel",
            email="admin@demo.com",
            password="admin12345",
            role=UserRole.ADMIN,
        )

        user_a = upsert_user(
            db=db,
            name="Spider-Man",
            email="usera@demo.com",
            password="usera12345",
            role=UserRole.STANDARD,
        )

        user_b = upsert_user(
            db=db,
            name="Storm",
            email="userb@demo.com",
            password="userb12345",
            role=UserRole.STANDARD,
        )

        client_a = get_or_create_client(
            db,
            "Dunder Mifflin Scranton",
            aliases=("Client A",),
        )
        client_b = get_or_create_client(
            db,
            "Schrute Farms",
            aliases=("Client B",),
        )

        project_x = get_or_create_project(
            db,
            name="Threat Level Midnight Ops",
            client_id=client_a.id,
            description="Mission-critical rollout for Scranton, with just enough drama to make Michael proud.",
            aliases=("Project X",),
        )
        project_y = get_or_create_project(
            db,
            name="Golden Ticket Portal",
            client_id=client_a.id,
            description="A playful side-quest implementation for sales experiments, surprise wins, and mild chaos.",
            aliases=("Project Y",),
        )
        project_z = get_or_create_project(
            db,
            name="Beet Force One",
            client_id=client_b.id,
            description="Core infrastructure for beet logistics, farm telemetry, and unapologetically efficient uptime.",
            aliases=("Project Z",),
        )

        get_or_create_instance(
            db,
            project_id=project_x.id,
            name="Threat Level Midnight Production",
            instance_type=InstanceType.PRODUCTION,
            status=InstanceStatus.ACTIVE,
            url="https://threat-level-midnight-prod.example.com",
            aliases=("Project X Production",),
        )
        get_or_create_instance(
            db,
            project_id=project_x.id,
            name="Threat Level Midnight Staging",
            instance_type=InstanceType.STAGING,
            status=InstanceStatus.ACTIVE,
            url="https://threat-level-midnight-staging.example.com",
            aliases=("Project X Staging",),
        )
        get_or_create_instance(
            db,
            project_id=project_y.id,
            name="Golden Ticket Dev Lair",
            instance_type=InstanceType.DEVELOPMENT,
            status=InstanceStatus.ACTIVE,
            url="https://golden-ticket-dev.example.com",
            aliases=("Project Y Development",),
        )
        get_or_create_instance(
            db,
            project_id=project_z.id,
            name="Beet Force One Legacy Production",
            instance_type=InstanceType.PRODUCTION,
            status=InstanceStatus.INACTIVE,
            url="https://beet-force-one-legacy.example.com",
            aliases=("Project Z Production Old",),
        )

        get_or_create_assignment(db, user_id=user_a.id, project_id=project_x.id)
        get_or_create_assignment(db, user_id=user_b.id, project_id=project_z.id)

        db.commit()

        print("Seed completed successfully.")
        print("Admin credentials (Captain Marvel): admin@demo.com / admin12345")
        print("Standard credentials (Spider-Man): usera@demo.com / usera12345")
        print("Standard credentials (Storm): userb@demo.com / userb12345")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
