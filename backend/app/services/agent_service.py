import json

from fastapi import HTTPException, status
from ollama import Client as OllamaClient
from ollamafreeapi import OllamaFreeAPI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.agent import AgentActionResult, AgentChatResponse, AgentPlan
from app.services.agent_tools import execute_agent_actions, plan_requires_confirmation
from app.services.permission_service import is_admin

_agent_client: OllamaFreeAPI | None = None
_preferred_server_urls: dict[str, str] = {}


def plan_agent_message(current_user: User, message: str) -> AgentPlan:
    prompt = _build_planning_prompt(current_user, message)

    try:
        raw_content = _chat_with_timeout(prompt)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to reach the configured Ollama Free API provider: {error}.",
        )

    try:
        plan_payload = _parse_plan_payload(raw_content)
        plan = AgentPlan.model_validate(plan_payload)
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama Free API returned an invalid planning response: {error}.",
        )

    plan.requires_confirmation = plan_requires_confirmation(
        plan.actions,
        explicit_flag=plan.requires_confirmation,
    )
    return plan


def execute_agent_plan(
    db: Session,
    current_user: User,
    plan: AgentPlan,
) -> list[AgentActionResult]:
    return execute_agent_actions(db, current_user, plan.actions)


def build_plan_response(plan: AgentPlan) -> AgentChatResponse:
    return AgentChatResponse(
        status="planned",
        assistant_message=f"Plan ready: {plan.summary}",
        plan=plan,
        results=[],
    )


def build_confirmation_response(plan: AgentPlan) -> AgentChatResponse:
    return AgentChatResponse(
        status="requires_confirmation",
        assistant_message=(
            "This plan includes destructive or high-impact changes. "
            "Re-submit with confirmed=true to execute it."
        ),
        plan=plan,
        results=[],
    )


def build_execution_response(
    plan: AgentPlan,
    results: list[AgentActionResult],
) -> AgentChatResponse:
    return AgentChatResponse(
        status="executed",
        assistant_message=f"Executed {len(results)} agent action(s): {plan.summary}",
        plan=plan,
        results=results,
    )


def _build_planning_prompt(current_user: User, message: str) -> str:
    role_label = "admin" if is_admin(current_user) else "standard"

    return f"""
You are an operations planning agent for Client Infrastructure Manager.
You do not execute anything yourself.
You only produce a JSON plan that the backend will validate and execute.

Current user role: {role_label}

Return a JSON object with this shape:
{{
  "summary": "short plain-language summary",
  "requires_confirmation": false,
  "notes": ["optional notes"],
  "actions": [
    {{
      "action": "supported_action_name",
      "alias": "optional_reference_name",
      "params": {{}}
    }}
  ]
}}

Supported actions:
- search_clients: params query
- ensure_client: params name
- create_client: params name
- update_client: params client_ref|client_id|client_name and name
- delete_client: params client_ref|client_id|client_name
- search_projects: params query|project_name|project_id|project_ref
- create_project: params name, optional description, and client_ref|client_id|client_name
- update_project: params project_ref|project_id|project_name
  and optional name, description, client_ref|client_id|client_name
- delete_project: params project_ref|project_id|project_name
- search_instances: params query|instance_name|instance_id|instance_ref
  and optional project_ref|project_id|project_name
- create_instance: params name, type, optional status, optional url,
  and project_ref|project_id|project_name
- update_instance: params instance_ref|instance_id|instance_name
  and optional name, type, status, url
- delete_instance: params instance_ref|instance_id|instance_name
- search_users: params query
- create_assignment: params project_ref|project_id|project_name and user_ref|user_id|user_query
- delete_assignment: params project_ref|project_id|project_name and user_ref|user_id|user_query

Planning rules:
- Use aliases when later actions depend on earlier actions.
- Prefer ensure_client when the user may want a client created if missing.
- Prefer search_users before create_assignment when the request gives only a human name.
- Set requires_confirmation=true for delete actions or moving a project to another client.
- For instance actions, type must be exactly one of: production, staging, development.
- For instance actions, status must be exactly one of: active, inactive.
- Do not invent IDs.
- Do not output markdown.
- If the user asks for something unsupported, return an empty actions array
  and explain that in summary or notes.

User request:
{message}
""".strip()


def _get_agent_client() -> OllamaFreeAPI:
    global _agent_client

    if _agent_client is None:
        _agent_client = OllamaFreeAPI()

    return _agent_client


def _chat_with_timeout(prompt: str) -> str:
    agent_client = _get_agent_client()
    candidate_models = _build_candidate_models()
    attempted_messages: list[str] = []

    for model in candidate_models:
        servers = agent_client.get_model_servers(model)

        if not servers:
            attempted_messages.append(f"{model}: no servers available")
            continue

        ordered_servers = _order_servers(model, servers)
        max_attempts = max(1, min(len(ordered_servers), settings.AGENT_MAX_SERVER_ATTEMPTS))
        request = agent_client.generate_api_request(
            model,
            prompt,
            temperature=settings.AGENT_TEMPERATURE,
            num_predict=settings.AGENT_NUM_PREDICT,
        )

        for server in ordered_servers[:max_attempts]:
            try:
                client = OllamaClient(
                    host=server["url"],
                    timeout=settings.AGENT_TIMEOUT_SECONDS,
                )
                response = client.generate(**request)
                _preferred_server_urls[model] = server["url"]
                return response["response"]
            except Exception as error:
                attempted_messages.append(f"{model} @ {server['url']}: {error}")

    available_models = sorted(set(agent_client.list_models()))
    suggested_models = ", ".join(available_models[:8]) if available_models else "none"
    attempts_summary = (
        "; ".join(attempted_messages[:6]) if attempted_messages else "no attempts were made"
    )

    raise RuntimeError(
        "All available Ollama Free API servers failed or timed out. "
        f"Tried models: {', '.join(candidate_models)}. "
        f"Attempts: {attempts_summary}. "
        f"Available models include: {suggested_models}."
    )


def _build_candidate_models() -> list[str]:
    candidate_models = [settings.AGENT_MODEL, *settings.AGENT_FALLBACK_MODELS]
    seen_models: set[str] = set()
    unique_models: list[str] = []

    for model in candidate_models:
        if model in seen_models:
            continue
        seen_models.add(model)
        unique_models.append(model)

    return unique_models


def _order_servers(model: str, servers: list[dict[str, object]]) -> list[dict[str, object]]:
    preferred_url = _preferred_server_urls.get(model)

    return sorted(
        servers,
        key=lambda server: (
            server["url"] != preferred_url,
            -_read_tokens_per_second(server),
        ),
    )


def _read_tokens_per_second(server: dict[str, object]) -> float:
    performance = server.get("performance")
    if not isinstance(performance, dict):
        return 0.0

    value = performance.get("tokens_per_second")
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _strip_code_fences(content: str) -> str:
    clean_content = content.strip()

    if clean_content.startswith("```"):
        lines = clean_content.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()

    return clean_content


def _parse_plan_payload(raw_content: str) -> dict[str, object]:
    decoder = json.JSONDecoder()
    clean_content = raw_content.strip()

    for index, character in enumerate(clean_content):
        if character != "{":
            continue

        try:
            payload, _ = decoder.raw_decode(clean_content[index:])
        except ValueError:
            continue

        if isinstance(payload, dict):
            return _normalize_plan_payload(payload)

    raise ValueError("No JSON object was found in the planning response.")


def _normalize_plan_payload(payload: dict[str, object]) -> dict[str, object]:
    normalized_payload = dict(payload)
    notes = normalized_payload.get("notes")

    if isinstance(notes, str):
        normalized_payload["notes"] = [notes]
    elif notes is None:
        normalized_payload["notes"] = []

    actions = normalized_payload.get("actions")
    if actions is None:
        normalized_payload["actions"] = []

    return normalized_payload
