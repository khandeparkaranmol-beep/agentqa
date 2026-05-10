from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent

# Default markers that indicate an agent believes the task is complete.
_DONE_MARKERS = (
    "task complete", "task completed", "done", "finished", "all done",
    "work complete", "completed successfully", "mission accomplished", "objective met",
)


class NoPrematureTerminationChecker(PropertyChecker):
    """Detect when an agent declares completion before all required milestones are met.

    The developer declares ``required_milestones`` — strings that must appear in
    the trace before any ``done_markers`` message is sent by the target agent.
    If a done signal is detected before a milestone appears, the check fails.

    params:
        agent (str): agent whose done-signals to monitor.
        required_milestones (list[str]): substrings that must each appear in at
            least one message (from any agent) before the target agent declares done.
        done_markers (list[str]): substrings that indicate the agent is signalling
            completion. Defaults to common "done" phrases.
        check_all_agents (bool, default False): if True, scan all agents' messages
            for done_markers (useful when any agent can terminate the session).

    Scenario YAML usage::

        assertions:
          - name: no_premature_termination
            params:
              agent: executor
              required_milestones:
                - "data validated"
                - "report generated"
                - "supervisor approved"
              done_markers:
                - "task complete"
                - "finished"
    """

    @property
    def name(self) -> str:
        return "no_premature_termination"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        milestones: list[str] = params.get("required_milestones", [])
        done_markers: list[str] = params.get("done_markers", list(_DONE_MARKERS))
        check_all: bool = params.get("check_all_agents", False)

        if not target_agent or not milestones:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent or required_milestones specified; check skipped.",
            )

        messages = trace.get_messages()

        # Find the first turn at which the target agent (or any agent) signals done
        done_turn: int | None = None
        done_event: TraceEvent | None = None
        for event in messages:
            sender = event.data.get("sender", event.agent or "")
            if check_all or sender == target_agent:
                content = event.data.get("content", "").lower()
                if any(marker.lower() in content for marker in done_markers):
                    done_turn = event.turn
                    done_event = event
                    break

        if done_turn is None:
            # No done signal found — check if all milestones appeared at all
            all_content = " ".join(
                e.data.get("content", "").lower() for e in messages
            )
            missing = [m for m in milestones if m.lower() not in all_content]
            if missing:
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Milestones never reached for '{target_agent}': "
                        f"missing — {missing}."
                    ),
                )
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details=f"All milestones observed; '{target_agent}' never sent a done signal.",
            )

        # Check that every milestone appeared before the done turn
        milestone_turns: dict[str, int | None] = {m: None for m in milestones}
        for event in messages:
            content = event.data.get("content", "").lower()
            for milestone in milestones:
                if milestone_turns[milestone] is None and milestone.lower() in content:
                    milestone_turns[milestone] = event.turn

        missing_before_done = [
            m for m, t in milestone_turns.items()
            if t is None or t >= done_turn
        ]

        if missing_before_done:
            return PropertyResult(
                property_name=self.name,
                passed=False,
                details=(
                    f"Premature termination: '{target_agent}' signalled done at turn {done_turn} "
                    f"before milestones were reached: {missing_before_done}."
                ),
                evidence=[done_event] if done_event else [],
                turn=done_turn,
            )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=(
                f"'{target_agent}' completed all {len(milestones)} milestone(s) "
                f"before signalling done at turn {done_turn}."
            ),
        )


registry.register(NoPrematureTerminationChecker())
