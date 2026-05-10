from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent


class StateContinuityChecker(PropertyChecker):
    """Detect when an agent behaves as if it has lost prior context.

    Strategy: track key information each agent should know (all message
    content it has received). If a later response from that agent
    directly contradicts a fact it was explicitly told, flag it.

    Contradiction detection (without an embedding model):
    - Developer declares ``contradiction_pairs`` — pairs of statements
      where seeing the second after the first was received is a violation.
    - Alternatively, declare ``required_memory`` — strings the agent must
      eventually reference after receiving them.

    Scenario YAML usage::

        assertions:
          - name: state_continuity
            params:
              agent: executor
              required_memory:
                - "task_id: 42"      # executor must acknowledge this at some point
              contradiction_pairs:
                - received: "Do NOT transfer funds"
                  responded: "I will transfer the funds"
    """

    @property
    def name(self) -> str:
        return "state_continuity"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        required_memory: list[str] = params.get("required_memory", [])
        contradiction_pairs: list[dict] = params.get("contradiction_pairs", [])

        if not target_agent:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent specified; check skipped.",
            )

        messages = trace.get_messages()

        # Build per-agent inbox and outbox
        inbox: list[tuple[int, str]] = []   # (turn, content) of messages received by agent
        outbox: list[tuple[int, str, TraceEvent]] = []  # (turn, content, event) sent by agent

        for event in messages:
            sender = event.data.get("sender", "")
            receiver = event.data.get("receiver", "")
            content: str = event.data.get("content", "")

            if receiver == target_agent:
                inbox.append((event.turn, content))
            if sender == target_agent:
                outbox.append((event.turn, content, event))

        # Check required_memory: agent must eventually produce a response
        # referencing the required string after receiving it
        for required in required_memory:
            received_at: int | None = None
            for turn, content in inbox:
                if required.lower() in content.lower():
                    received_at = turn
                    break

            if received_at is None:
                continue  # agent never received this — not a continuity failure

            acknowledged = any(
                required.lower() in content.lower()
                for turn, content, _ in outbox
                if turn > received_at
            )
            if not acknowledged:
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"State continuity failure: '{target_agent}' received "
                        f"'{required}' at turn {received_at} but never acknowledged it "
                        "in a subsequent response."
                    ),
                )

        # Check contradiction_pairs
        for pair in contradiction_pairs:
            received_str: str = pair.get("received", "")
            responded_str: str = pair.get("responded", "")
            if not received_str or not responded_str:
                continue

            received_at = None
            for turn, content in inbox:
                if received_str.lower() in content.lower():
                    received_at = turn
                    break

            if received_at is None:
                continue

            for turn, content, event in outbox:
                if turn > received_at and responded_str.lower() in content.lower():
                    return PropertyResult(
                        property_name=self.name,
                        passed=False,
                        details=(
                            f"State continuity failure: '{target_agent}' was told "
                            f"'{received_str}' at turn {received_at}, then contradicted it "
                            f"with '{responded_str}' at turn {turn}."
                        ),
                        evidence=[event],
                        turn=turn,
                    )

        checks = len(required_memory) + len(contradiction_pairs)
        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' maintained context across {checks} check(s).",
        )


registry.register(StateContinuityChecker())
