from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import app.services.agent_service as agent_service
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.agent import AgentChatRequest, AgentChatResponse

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=AgentChatResponse)
def chat_with_agent(
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AgentChatResponse:
    plan = agent_service.plan_agent_message(current_user, payload.message)
    plan.requires_confirmation = agent_service.plan_requires_confirmation(
        plan.actions,
        explicit_flag=plan.requires_confirmation,
    )

    if payload.mode == "plan":
        return agent_service.build_plan_response(plan)

    if plan.requires_confirmation and not payload.confirmed:
        return agent_service.build_confirmation_response(plan)

    results = agent_service.execute_agent_plan(db, current_user, plan)
    return agent_service.build_execution_response(plan, results)
