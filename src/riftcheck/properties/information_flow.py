from __future__ import annotations

from riftcheck.properties.base import PropertyChecker, PropertyResult, registry
from riftcheck.scenario import ScenarioConfig
from riftcheck.trace import Trace, TraceEvent


class InformationFlowChecker(PropertyChecker):
    """Verify that Agent A actually shares specific data with Agent B.

    Scenario YAML usage::

        assertions:
          - name: ensures_information_flow
            params:
              flows:
                - from: coordinator
                  to: executor
                  field: task_id    # key in coordinator's setup data
                - from: coordinator
                  to: reviewer
                  value: "approved" # literal string that must appear

    Each declared flow must appear in at least one message from `from`
    to `to` (or any message received by `to`).
    """

    @property
    def name(self) -> str:
        return "ensures_information_flow"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        flows: list[dict] = params.get("flows", [])

        if not flows:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No required information flows declared; check skipped.",
            )

        messages = trace.get_messages()

        for flow in flows:
            from_agent: str | None = flow.get("from")
            to_agent: str | None = flow.get("to")
            field: str | None = flow.get("field")
            literal: str | None = flow.get("value")

            if field:
                # Resolve value from setup data of the from_agent
                setup = scenario.setup.get(from_agent or "", {})
                if isinstance(setup, dict) and field in setup:
                    value = str(setup[field])
                else:
                    value = field  # fall back to treating the field name as the value
            elif literal:
                value = literal
            else:
                continue

            found = False
            for event in messages:
                sender = event.data.get("sender", "")
                receiver = event.data.get("receiver", "")
                content: str = event.data.get("content", "")

                # The information must travel FROM the source agent
                if from_agent and sender != from_agent:
                    continue
                # AND reach the destination agent
                if to_agent and receiver != to_agent:
                    continue

                if value.lower() in content.lower():
                    found = True
                    break

            if not found:
                label = f"field '{field}'" if field else f"value '{literal}'"
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Required information flow not observed: "
                        f"{from_agent or 'any'} → {to_agent or 'any'} "
                        f"({label} = '{value}' never appeared in transit)."
                    ),
                )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"All {len(flows)} required information flow(s) observed.",
        )


registry.register(InformationFlowChecker())
