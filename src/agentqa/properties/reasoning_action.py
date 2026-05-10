from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent

# Marker strings agents use to express reasoning/intent before acting.
_INTENT_MARKERS = ("i will", "i'll", "i plan to", "i intend to", "i am going to", "i'm going to")


class ReasoningActionConsistencyChecker(PropertyChecker):
    """Detect when an agent's stated reasoning contradicts its actual action.

    Detection: scan each agent's outgoing messages for an intent statement
    (e.g. "I will do X") followed by an action that contradicts a declared
    negation pair.

    Developer declares ``contradiction_pairs`` — each pair has a
    ``stated_intent`` substring and a ``contradicting_action`` substring.
    If the agent says ``stated_intent`` in one message and then sends
    ``contradicting_action`` in any subsequent message, it's a violation.

    Scenario YAML usage::

        assertions:
          - name: reasoning_action_consistency
            params:
              agent: executor
              contradiction_pairs:
                - stated_intent: "I will not transfer"
                  contradicting_action: "transfer complete"
                - stated_intent: "I plan to escalate"
                  contradicting_action: "marking as resolved"
    """

    @property
    def name(self) -> str:
        return "reasoning_action_consistency"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        pairs: list[dict] = params.get("contradiction_pairs", [])

        if not target_agent or not pairs:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent or contradiction_pairs specified; check skipped.",
            )

        messages = trace.get_messages()
        agent_msgs = [
            (e.turn, e.data.get("content", ""), e)
            for e in messages
            if e.data.get("sender", e.agent or "") == target_agent
        ]

        for pair in pairs:
            stated: str = pair.get("stated_intent", "")
            contradicts: str = pair.get("contradicting_action", "")
            if not stated or not contradicts:
                continue

            stated_at: int | None = None
            for turn, content, _ in agent_msgs:
                if stated.lower() in content.lower():
                    stated_at = turn
                    break

            if stated_at is None:
                continue

            for turn, content, event in agent_msgs:
                if turn > stated_at and contradicts.lower() in content.lower():
                    return PropertyResult(
                        property_name=self.name,
                        passed=False,
                        details=(
                            f"Reasoning-action mismatch for '{target_agent}': "
                            f"stated '{stated}' at turn {stated_at}, "
                            f"then did '{contradicts}' at turn {turn}."
                        ),
                        evidence=[event],
                        turn=turn,
                    )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' acted consistently with its stated reasoning.",
        )


registry.register(ReasoningActionConsistencyChecker())
