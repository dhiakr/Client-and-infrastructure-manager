import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.enums import UserRole
from app.services.agent_service import (
    _build_candidate_models,
    _order_servers,
    _parse_plan_payload,
    _preferred_server_urls,
    plan_agent_message,
)


def test_plan_agent_message_parses_valid_provider_payload(factory, monkeypatch):
    admin = factory.user(
        name="Agent Planner",
        email="agent.planner@example.com",
        role=UserRole.ADMIN,
    )

    monkeypatch.setattr(
        "app.services.agent_service._chat_with_timeout",
        lambda prompt: (
            '{"summary":"Plan created.","requires_confirmation":false,'
            '"notes":[],"actions":[]}'
        ),
    )

    plan = plan_agent_message(admin, "Create a client called Alpha")

    assert plan.summary == "Plan created."
    assert plan.requires_confirmation is False
    assert plan.actions == []


def test_plan_agent_message_wraps_provider_timeout_as_gateway_error(factory, monkeypatch):
    admin = factory.user(
        name="Agent Planner",
        email="agent.timeout@example.com",
        role=UserRole.ADMIN,
    )

    def raise_timeout(prompt: str):
        raise TimeoutError("provider timed out")

    monkeypatch.setattr(
        "app.services.agent_service._chat_with_timeout",
        raise_timeout,
    )

    with pytest.raises(HTTPException) as error:
        plan_agent_message(admin, "Create a client called Alpha")

    assert error.value.status_code == 502
    assert "provider timed out" in error.value.detail


def test_parse_plan_payload_extracts_json_from_preface_and_normalizes_notes():
    payload = _parse_plan_payload(
        """Here is the JSON plan:

```json
{
  "summary": "Create a new project under a new client",
  "requires_confirmation": false,
  "notes": "Please review the created resources for accuracy.",
  "actions": []
}
```"""
    )

    assert payload["summary"] == "Create a new project under a new client"
    assert payload["notes"] == ["Please review the created resources for accuracy."]


def test_build_candidate_models_deduplicates_primary_and_fallbacks(monkeypatch):
    monkeypatch.setattr(settings, "AGENT_MODEL", "llama3.2:3b")
    monkeypatch.setattr(
        settings,
        "AGENT_FALLBACK_MODELS",
        ["llama3.2:latest", "llama3.2:3b", "mistral:latest"],
    )

    assert _build_candidate_models() == [
        "llama3.2:3b",
        "llama3.2:latest",
        "mistral:latest",
    ]


def test_order_servers_prefers_cached_server_then_higher_throughput():
    _preferred_server_urls.clear()
    _preferred_server_urls["llama3.2:3b"] = "http://slow-but-known"

    ordered = _order_servers(
        "llama3.2:3b",
        [
            {"url": "http://fast-new", "performance": {"tokens_per_second": "20.0"}},
            {"url": "http://slow-but-known", "performance": {"tokens_per_second": "1.0"}},
            {"url": "http://mid-new", "performance": {"tokens_per_second": "10.0"}},
        ],
    )

    assert [server["url"] for server in ordered] == [
        "http://slow-but-known",
        "http://fast-new",
        "http://mid-new",
    ]
