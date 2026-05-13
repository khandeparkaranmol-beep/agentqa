from __future__ import annotations

from riftcheck.properties.base import PropertyChecker, PropertyResult, registry
from riftcheck.scenario import ScenarioConfig
from riftcheck.trace import Trace, TraceEvent


def _state_fingerprint(state: dict) -> frozenset[tuple]:
    """Stable fingerprint of a state dict — a frozenset of (key, str(val)) pairs."""
    return frozenset((k, str(v)) for k, v in state.items())


def _overlap_ratio(a: frozenset, b: frozenset) -> float:
    """Jaccard similarity between two frozensets."""
    if not a and not b:
        return 1.0
    union = a | b
    return len(a & b) / len(union)


class ConversationResetChecker(PropertyChecker):
    """Detect when an agent's accumulated state unexpectedly reverts to near-initial state.

    Uses state_change events from the trace. If an agent's state at turn T
    is more similar to its state at turn 0 than to its state at turn T-1,
    it suggests a reset.

    params:
        agent (str): agent to monitor.
        reset_threshold (float, default 0.8): how similar to initial state triggers a flag.
        lookback (int, default 1): how many previous turns to compare against.
    """

    @property
    def name(self) -> str:
        return "no_conversation_reset"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        reset_threshold: float = params.get("reset_threshold", 0.8)

        if not target_agent:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent specified; check skipped.",
            )

        state_events = [
            e for e in trace.events
            if e.type == "state_change" and e.agent == target_agent
        ]

        if len(state_events) < 3:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details=(
                    f"Fewer than 3 state snapshots for '{target_agent}'; "
                    "reset check skipped."
                ),
            )

        initial_fp = _state_fingerprint(state_events[0].data.get("state", {}))

        for i in range(2, len(state_events)):
            prev_fp = _state_fingerprint(state_events[i - 1].data.get("state", {}))
            curr_fp = _state_fingerprint(state_events[i].data.get("state", {}))

            similarity_to_initial = _overlap_ratio(curr_fp, initial_fp)
            similarity_to_prev = _overlap_ratio(curr_fp, prev_fp)

            # A reset is: current is much closer to initial than to previous,
            # AND the similarity to initial is above the threshold.
            if (
                similarity_to_initial >= reset_threshold
                and similarity_to_initial > similarity_to_prev + 0.2
            ):
                event = state_events[i]
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Conversation reset detected for '{target_agent}' at turn "
                        f"{event.turn}: state similarity to initial = "
                        f"{similarity_to_initial:.2f}, to previous = "
                        f"{similarity_to_prev:.2f}."
                    ),
                    evidence=[event],
                    turn=event.turn,
                )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"No conversation reset detected for '{target_agent}'.",
        )


registry.register(ConversationResetChecker())
