from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent


def _keyword_overlap(text: str, keywords: list[str]) -> float:
    """Fraction of keywords that appear in text (case-insensitive)."""
    if not keywords:
        return 1.0
    text_lower = text.lower()
    hits = sum(1 for kw in keywords if kw.lower() in text_lower)
    return hits / len(keywords)


class StaysOnTaskChecker(PropertyChecker):
    """Detect when an agent semantically drifts from its assigned objective.

    Strategy: the developer declares ``task_keywords`` — terms central to
    the agent's task. If an agent's messages consistently fail to reference
    any of these keywords after an initial warm-up period, it's flagged
    as having drifted off-task.

    params:
        agent (str): agent to monitor.
        task_keywords (list[str]): words/phrases that must appear in messages.
        min_overlap (float, default 0.2): minimum fraction of keywords a message
            must contain. Messages below this are counted as off-task.
        max_offtask_consecutive (int, default 3): how many consecutive off-task
            messages trigger a failure.
        warmup_turns (int, default 1): ignore the first N messages (setup chatter).

    Scenario YAML usage::

        assertions:
          - name: stays_on_task
            params:
              agent: executor
              task_keywords: ["PROJ-101", "analysis", "results"]
              min_overlap: 0.2
              max_offtask_consecutive: 3
    """

    @property
    def name(self) -> str:
        return "stays_on_task"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        keywords: list[str] = params.get("task_keywords", [])
        min_overlap: float = params.get("min_overlap", 0.2)
        max_offtask: int = params.get("max_offtask_consecutive", 3)
        warmup: int = params.get("warmup_turns", 1)

        if not target_agent or not keywords:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent or task_keywords specified; check skipped.",
            )

        agent_msgs = [
            e for e in trace.get_messages()
            if e.data.get("sender", e.agent or "") == target_agent
        ]

        consecutive_offtask = 0
        offtask_evidence: list[TraceEvent] = []

        for i, event in enumerate(agent_msgs):
            if i < warmup:
                continue
            content: str = event.data.get("content", "")
            overlap = _keyword_overlap(content, keywords)
            if overlap < min_overlap:
                consecutive_offtask += 1
                offtask_evidence.append(event)
                if consecutive_offtask >= max_offtask:
                    return PropertyResult(
                        property_name=self.name,
                        passed=False,
                        details=(
                            f"Task derailment: '{target_agent}' sent "
                            f"{consecutive_offtask} consecutive off-task messages "
                            f"(keyword overlap < {min_overlap:.0%}). "
                            f"First at turn {offtask_evidence[0].turn}."
                        ),
                        evidence=offtask_evidence,
                        turn=offtask_evidence[0].turn,
                    )
            else:
                consecutive_offtask = 0
                offtask_evidence = []

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' stayed on task across all messages.",
        )


registry.register(StaysOnTaskChecker())
