from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent


class DeadlockChecker(PropertyChecker):
    """Check that agents don't get stuck in a deadlock or ping-pong loop.

    Two detection modes:
    1. All-same: the last N messages from all agents have identical content.
    2. Ping-pong: two agents alternate the exact same pair of messages ≥ 3 cycles.
    """

    @property
    def name(self) -> str:
        return "no_deadlock"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        lookback: int = params.get("lookback", 4)
        messages = trace.get_messages()

        if len(messages) < lookback:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details=f"Fewer than {lookback} messages; deadlock check skipped.",
            )

        # All-same detection: last `lookback` messages all have identical content
        recent = messages[-lookback:]
        contents = [e.data.get("content", "").strip() for e in recent]
        if len(set(contents)) == 1:
            return PropertyResult(
                property_name=self.name,
                passed=False,
                details=(
                    f"Deadlock detected: last {lookback} messages all contain "
                    f"'{contents[0][:60]}'."
                ),
                evidence=recent,
                turn=recent[-1].turn,
            )

        # Ping-pong detection: alternating pair repeated ≥ 3 times
        if len(messages) >= 6:
            ping_pong = self._check_ping_pong(messages)
            if ping_pong:
                return ping_pong

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details="No deadlock detected.",
        )

    def _check_ping_pong(self, messages: list[TraceEvent]) -> PropertyResult | None:
        for window_start in range(len(messages) - 5):
            a = messages[window_start].data.get("content", "").strip()
            b = messages[window_start + 1].data.get("content", "").strip()
            cycle_count = 1

            i = window_start + 2
            while i + 1 < len(messages):
                if (
                    messages[i].data.get("content", "").strip() == a
                    and messages[i + 1].data.get("content", "").strip() == b
                ):
                    cycle_count += 1
                    i += 2
                else:
                    break

            if cycle_count >= 3:
                evidence = messages[window_start: window_start + cycle_count * 2]
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Ping-pong deadlock: pair ('{a[:40]}' / '{b[:40]}') "
                        f"repeated {cycle_count} times."
                    ),
                    evidence=evidence,
                    turn=evidence[-1].turn,
                )
        return None


registry.register(DeadlockChecker())
