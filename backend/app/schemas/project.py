from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.assignment import ProjectAssignmentResponse
from app.schemas.client import ClientSummaryResponse
from app.schemas.instance import InstanceResponse


class ProjectCreate(BaseModel):
    client_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    client_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ProjectWorkspaceResponse(ProjectResponse):
    client: ClientSummaryResponse
    instances: list[InstanceResponse]
    assignments: list[ProjectAssignmentResponse]
