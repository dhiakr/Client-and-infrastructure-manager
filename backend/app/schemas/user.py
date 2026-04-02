from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole


class UserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    name: str
    email: EmailStr
    role: UserRole