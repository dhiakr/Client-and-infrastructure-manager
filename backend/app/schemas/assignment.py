from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserSummaryResponse


class ProjectAssignmentCreate(BaseModel):
    user_id: int = Field(gt=0)


class ProjectAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    created_at: datetime
    user: UserSummaryResponse