from typing import Any, Literal

from pydantic import BaseModel, Field

AgentActionName = Literal[
    "search_clients",
    "ensure_client",
    "create_client",
    "update_client",
    "delete_client",
    "search_projects",
    "create_project",
    "update_project",
    "delete_project",
    "search_instances",
    "create_instance",
    "update_instance",
    "delete_instance",
    "search_users",
    "create_assignment",
    "delete_assignment",
]


class AgentAction(BaseModel):
    action: AgentActionName
    alias: str | None = Field(default=None, max_length=64)
    params: dict[str, Any] = Field(default_factory=dict)


class AgentPlan(BaseModel):
    summary: str = Field(min_length=1, max_length=1000)
    requires_confirmation: bool = False
    notes: list[str] = Field(default_factory=list)
    actions: list[AgentAction] = Field(default_factory=list)


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: Literal["plan", "execute"] = "plan"
    confirmed: bool = False


class AgentReference(BaseModel):
    kind: Literal["client", "project", "instance", "user", "assignment"]
    id: int | None = None
    name: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class AgentActionResult(BaseModel):
    action: AgentActionName
    alias: str | None = None
    status: Literal["found", "resolved", "created", "updated", "deleted", "assigned", "removed"]
    message: str
    reference: AgentReference | None = None


class AgentChatResponse(BaseModel):
    status: Literal["planned", "requires_confirmation", "executed"]
    assistant_message: str
    plan: AgentPlan
    results: list[AgentActionResult] = Field(default_factory=list)
