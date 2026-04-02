from app.models.assignment import ProjectAssignment as ProjectAssignment
from app.models.base import Base as Base
from app.models.client import Client as Client
from app.models.instance import OdooInstance as OdooInstance
from app.models.project import Project as Project
from app.models.user import User as User

__all__ = ["Base", "Client", "OdooInstance", "Project", "ProjectAssignment", "User"]
