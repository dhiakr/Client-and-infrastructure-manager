from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CurrentUserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Literal["admin", "standard"]


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: CurrentUserResponse


class TokenPayload(BaseModel):
    sub: str
    exp: int | None = None
    role: Literal["admin", "standard"] | None = None
