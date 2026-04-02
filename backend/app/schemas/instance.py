from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InstanceStatus, InstanceType


class InstanceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: InstanceType
    status: InstanceStatus
    url: str | None = Field(default=None, max_length=500)


class InstanceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: InstanceType | None = None
    status: InstanceStatus | None = None
    url: str | None = Field(default=None, max_length=500)


class InstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    project_id: int
    name: str
    type: InstanceType
    status: InstanceStatus
    url: str | None
    created_at: datetime
    updated_at: datetime