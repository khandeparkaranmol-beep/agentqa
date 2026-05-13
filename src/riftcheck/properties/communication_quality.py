from __future__ import annotations

from riftcheck.properties.base import PropertyChecker, PropertyResult, registry
from riftcheck.scenario import ScenarioConfig
from riftcheck.trace import Trace

# Default acknowledgement markers used when none are specified.
_DEFAULT_ACK_MARKERS = ("acknowledged", "understood", "confirmed", "noted", "received")


def _average_length(messages: list[str]) -> float:
    if not messages:
        return 0.0
    return sum(len(m) for m in messages) / len(messages)


def _brevity_rate(messages: list[str], max_length: int) -> float:
    """Fraction of messages with character count <= max_length."""
    if not messages:
        return 1.0
    return sum(1 for m in messages if len(m) <= max_length) / len(messages)


def _ack_rate(messages: list[str], markers: list[str]) -> float:
    """Fraction of messages containing at least one acknowledgement marker."""
    if not messages:
        return 0.0
    hits = sum(
        1 for m in messages
        if any(mk.lower() in m.lower() for mk in markers)
    )
    return hits / len(messages)


class CommunicationQualityChecker(PropertyChecker):
    """Score the overall communication quality of an agent's messages.

    Computes three sub-metrics and returns an aggregate quality score in [0, 1].
    The check passes when ``score >= min_score``.

    Sub-metrics (each contributes equally by default):
    - **avg_length_score**: 1.0 if average message length >= ``min_avg_length``,
      else proportional (avg / min_avg_length, capped at 1.0).
    - **brevity_score**: fraction of messages whose length <= ``max_msg_length``.
    - **ack_score**: fraction of messages containing an acknowledgement marker.

    params:
        agent (str): agent to evaluate.
        min_score (float, default 0.5): minimum aggregate score to pass.
        min_avg_length (int, default 50): target minimum average message length
            (in characters) for a full avg_length_score.
        max_msg_length (int, default 500): upper bound for the brevity metric.
        ack_markers (list[str]): acknowledgement keywords. Defaults to
            ["acknowledged", "understood", "confirmed", "noted", "received"].
        weights (dict): optional per-metric weights with keys ``avg_length``,
            ``brevity``, ``ack``. Defaults to equal weighting (0.333 each).

    Scenario YAML usage::

        assertions:
          - name: communication_quality
            params:
              agent: executor
              min_score: 0.6
              min_avg_length: 80
              max_msg_length: 400
    """

    @property
    def name(self) -> str:
        return "communication_quality"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        min_score: float = params.get("min_score", 0.5)
        min_avg_length: int = params.get("min_avg_length", 50)
        max_msg_length: int = params.get("max_msg_length", 500)
        ack_markers: list[str] = params.get("ack_markers", list(_DEFAULT_ACK_MARKERS))
        weights: dict = params.get("weights", {})

        w_avg = float(weights.get("avg_length", 1.0))
        w_brev = float(weights.get("brevity", 1.0))
        w_ack = float(weights.get("ack", 1.0))
        total_w = w_avg + w_brev + w_ack

        if not target_agent:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent specified; check skipped.",
            )

        messages = [
            e.data.get("content", "")
            for e in trace.get_messages()
            if e.data.get("sender", e.agent or "") == target_agent
        ]

        if not messages:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details=f"No messages found for '{target_agent}'; check skipped.",
            )

        avg_len = _average_length(messages)
        avg_len_score = min(avg_len / min_avg_length, 1.0) if min_avg_length > 0 else 1.0
        brev_score = _brevity_rate(messages, max_msg_length)
        ack_score = _ack_rate(messages, ack_markers)

        composite = (w_avg * avg_len_score + w_brev * brev_score + w_ack * ack_score) / total_w
        passed = composite >= min_score

        details = (
            f"Communication quality score for '{target_agent}': {composite:.2f} "
            f"(threshold: {min_score:.2f}). "
            f"avg_length={avg_len:.0f}chars (score={avg_len_score:.2f}), "
            f"brevity={brev_score:.2f}, ack_rate={ack_score:.2f}."
        )
        if not passed:
            details += f" Score {composite:.2f} below minimum {min_score:.2f}."

        return PropertyResult(
            property_name=self.name,
            passed=passed,
            details=details,
        )


registry.register(CommunicationQualityChecker())
