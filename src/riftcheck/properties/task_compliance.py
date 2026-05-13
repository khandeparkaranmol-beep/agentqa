from __future__ import annotations

from riftcheck.properties.base import PropertyChecker, PropertyResult, registry
from riftcheck.scenario import ScenarioConfig
from riftcheck.trace import Trace, TraceEvent


def _compliance_score(content: str, required: list[str], forbidden: list[str]) -> tuple[float, list[str], list[str]]:
    """Compute a keyword-based compliance score.

    Returns:
        (score 0-1, missing required terms, found forbidden terms)
    """
    content_lower = content.lower()
    missing = [r for r in required if r.lower() not in content_lower]
    violations = [f for f in forbidden if f.lower() in content_lower]

    if not required and not forbidden:
        return 1.0, [], []

    # Score: fraction of required terms present, penalised by forbidden terms found
    required_score = (len(required) - len(missing)) / len(required) if required else 1.0
    forbidden_penalty = len(violations) / max(len(forbidden), 1) if forbidden else 0.0
    score = max(0.0, required_score - forbidden_penalty)
    return score, missing, violations


class TaskSpecificationComplianceChecker(PropertyChecker):
    """Verify that an agent's outputs comply with natural-language task specifications.

    This is a keyword-based approximation of LLM-as-judge compliance checking
    (the approach validated by MAST). The developer declares required and
    forbidden terms for specific agents. The checker computes a compliance
    score and fails if it falls below ``min_compliance``.

    For each ``compliance_rule``, the checker evaluates all messages from the
    target agent and fails if the aggregate score is below the threshold.

    params:
        compliance_rules (list[dict]): each rule has:
            - ``agent`` (str): agent to evaluate.
            - ``required_terms`` (list[str]): terms that should appear.
            - ``forbidden_terms`` (list[str]): terms that must NOT appear.
            - ``min_compliance`` (float, default 0.8): minimum score to pass.
            - ``scope`` (str): "any" (at least one message complies) or
              "all" (every message must comply). Default: "any".
            - ``label`` (str, optional): human-readable rule name for reports.

    Scenario YAML usage::

        assertions:
          - name: task_specification_compliance
            params:
              compliance_rules:
                - agent: executor
                  label: "must produce report with summary"
                  required_terms: ["summary", "findings", "recommendation"]
                  forbidden_terms: ["error", "failed", "unable to"]
                  min_compliance: 0.7
                  scope: any
    """

    @property
    def name(self) -> str:
        return "task_specification_compliance"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        rules: list[dict] = params.get("compliance_rules", [])

        if not rules:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No compliance_rules specified; check skipped.",
            )

        messages = trace.get_messages()
        failures: list[str] = []

        for rule in rules:
            agent: str = rule.get("agent", "")
            required: list[str] = rule.get("required_terms", [])
            forbidden: list[str] = rule.get("forbidden_terms", [])
            min_compliance: float = rule.get("min_compliance", 0.8)
            scope: str = rule.get("scope", "any")
            label: str = rule.get("label", f"rule for '{agent}'")

            if not agent:
                continue

            agent_msgs = [
                e for e in messages
                if e.data.get("sender", e.agent or "") == agent
            ]

            if not agent_msgs:
                failures.append(f"{label}: no messages from '{agent}'.")
                continue

            scores: list[tuple[float, list[str], list[str], TraceEvent]] = []
            for event in agent_msgs:
                content = event.data.get("content", "")
                score, missing, violations = _compliance_score(content, required, forbidden)
                scores.append((score, missing, violations, event))

            if scope == "any":
                best_score, best_missing, best_violations, best_event = max(scores, key=lambda x: x[0])
                if best_score < min_compliance:
                    failures.append(
                        f"{label}: best compliance score {best_score:.2f} < {min_compliance:.2f}. "
                        f"Missing: {best_missing}. Forbidden found: {best_violations}."
                    )
            else:  # scope == "all"
                worst_score, worst_missing, worst_violations, worst_event = min(scores, key=lambda x: x[0])
                if worst_score < min_compliance:
                    failures.append(
                        f"{label}: worst compliance score {worst_score:.2f} < {min_compliance:.2f} "
                        f"at turn {worst_event.turn}. "
                        f"Missing: {worst_missing}. Forbidden found: {worst_violations}."
                    )

        if failures:
            return PropertyResult(
                property_name=self.name,
                passed=False,
                details=f"Task specification compliance failures: {'; '.join(failures)}",
            )

        rule_labels = [r.get("label", f"rule for '{r.get('agent')}'") for r in rules]
        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"All {len(rules)} compliance rule(s) passed: {rule_labels}.",
        )


registry.register(TaskSpecificationComplianceChecker())
