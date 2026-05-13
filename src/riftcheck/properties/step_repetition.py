from __future__ import annotations

import re

from riftcheck.properties.base import PropertyChecker, PropertyResult, registry
from riftcheck.scenario import ScenarioConfig
from riftcheck.trace import Trace, TraceEvent


def _fingerprint(text: str) -> str:
    """Structural fingerprint: collapse runs of digits and strip filler words."""
    text = text.lower().strip()
    # Collapse all digit sequences to a placeholder so "step 1" and "step 2" match
    text = re.sub(r"\d+", "<N>", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text


class StepRepetitionChecker(PropertyChecker):
    """Detect agents stuck in a repetitive loop — sending structurally identical messages.

    Strategy: each agent message is reduced to a structural fingerprint (digits
    normalised, whitespace collapsed). If the same fingerprint appears more than
    ``max_repeats`` times across ALL of an agent's messages, the agent is looping.

    This is a structural check, not semantic — it catches "I will now do step N"
    repeated forever but won't fire on legitimately varied messages that happen to
    share a word.

    params:
        agent (str): agent to monitor.
        max_repeats (int, default 3): how many times the same structural fingerprint
            is allowed before the check fails.
        min_length (int, default 20): fingerprints shorter than this are ignored
            (short ack messages like "ok" or "done" are not loops).

    Scenario YAML usage::

        assertions:
          - name: step_repetition
            params:
              agent: executor
              max_repeats: 3
    """

    @property
    def name(self) -> str:
        return "step_repetition"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        max_repeats: int = params.get("max_repeats", 3)
        min_length: int = params.get("min_length", 20)

        if not target_agent:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent specified; check skipped.",
            )

        agent_msgs = [
            e for e in trace.get_messages()
            if e.data.get("sender", e.agent or "") == target_agent
        ]

        fingerprint_counts: dict[str, int] = {}
        fingerprint_first_event: dict[str, TraceEvent] = {}
        fingerprint_evidence: dict[str, list[TraceEvent]] = {}

        for event in agent_msgs:
            content: str = event.data.get("content", "")
            fp = _fingerprint(content)
            if len(fp) < min_length:
                continue  # short acks not counted

            fingerprint_counts[fp] = fingerprint_counts.get(fp, 0) + 1
            if fp not in fingerprint_first_event:
                fingerprint_first_event[fp] = event
                fingerprint_evidence[fp] = []
            fingerprint_evidence[fp].append(event)

            if fingerprint_counts[fp] > max_repeats:
                first = fingerprint_first_event[fp]
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Step repetition detected: '{target_agent}' sent structurally "
                        f"identical messages {fingerprint_counts[fp]} times "
                        f"(max allowed: {max_repeats}). "
                        f"First occurrence at turn {first.turn}. "
                        f"Pattern: \"{content[:60]}{'...' if len(content) > 60 else ''}\""
                    ),
                    evidence=fingerprint_evidence[fp],
                    turn=first.turn,
                )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' showed no structural message repetition.",
        )


registry.register(StepRepetitionChecker())
