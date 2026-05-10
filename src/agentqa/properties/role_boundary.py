from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace


class RoleBoundaryChecker(PropertyChecker):
    """Check that an agent doesn't perform actions forbidden by its role.

    params:
        agent (str): the agent to monitor.
        forbidden_actions (list[str]): substrings that must not appear in
            that agent's outgoing messages.
    """

    @property
    def name(self) -> str:
        return "role_boundary"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        forbidden: list[str] = params.get("forbidden_actions", [])

        if not target_agent or not forbidden:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent or forbidden_actions specified; check skipped.",
            )

        for event in trace.get_messages():
            sender = event.data.get("sender", event.agent or "")
            if sender != target_agent:
                continue

            content: str = event.data.get("content", "")
            for action in forbidden:
                if action.lower() in content.lower():
                    return PropertyResult(
                        property_name=self.name,
                        passed=False,
                        details=(
                            f"Role violation: '{target_agent}' used forbidden action "
                            f"'{action}' at turn {event.turn}."
                        ),
                        evidence=[event],
                        turn=event.turn,
                    )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' stayed within role boundaries.",
        )


registry.register(RoleBoundaryChecker())
