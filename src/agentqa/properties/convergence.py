from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace

_CONVERGENCE_MARKERS = ("agreed", "deal", "done", "accepted", "settled")


class ConvergesWithinChecker(PropertyChecker):
    """Check that the interaction reaches a done/agreed state within N turns.

    Convergence is detected when:
    - Any message content contains a convergence marker (case-insensitive), or
    - Any message's metadata contains {"done": true}.
    """

    @property
    def name(self) -> str:
        return "converges_within"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        max_turns: int = params.get("max_turns", scenario.turns)
        markers: list[str] = params.get("markers", list(_CONVERGENCE_MARKERS))

        for event in trace.get_messages():
            if event.turn > max_turns:
                break

            content: str = event.data.get("content", "").lower()
            metadata: dict = event.data.get("metadata", {})

            if metadata.get("done") is True:
                return PropertyResult(
                    property_name=self.name,
                    passed=True,
                    details=f"Converged at turn {event.turn} (metadata done=true).",
                    turn=event.turn,
                )

            for marker in markers:
                if marker.lower() in content:
                    return PropertyResult(
                        property_name=self.name,
                        passed=True,
                        details=f"Converged at turn {event.turn} (marker '{marker}' found).",
                        turn=event.turn,
                    )

        last_turn = max(e.turn for e in trace.get_messages()) if trace.get_messages() else 0
        return PropertyResult(
            property_name=self.name,
            passed=False,
            details=(
                f"No convergence detected within {max_turns} turns "
                f"(ran to turn {last_turn})."
            ),
        )


registry.register(ConvergesWithinChecker())
