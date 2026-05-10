from __future__ import annotations

import logging
import time

from agentqa.agent import AgentUnderTest, Message
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent

logger = logging.getLogger(__name__)


class SimulationEngine:
    """Orchestrates multi-agent simulations and records every event to a Trace.

    Agents never call each other directly. All communication routes through
    the engine, which applies fault injections and records everything.
    """

    def __init__(self, agents: list[AgentUnderTest], scenario: ScenarioConfig) -> None:
        self._agents = agents
        self._scenario = scenario
        self._agent_map: dict[str, AgentUnderTest] = {a.name: a for a in agents}

    def run_once(self) -> Trace:
        """Execute one full simulation run and return its Trace.

        Turn 0: each agent receives its setup prompt from scenario.setup,
        or a generic 'Begin the interaction.' if no setup is defined.
        Subsequent turns: each agent receives the previous active agent's response.
        Agents act in round-robin order.
        """
        trace = Trace()

        for agent in self._agents:
            agent.setup()

        previous_response_content = "Begin the interaction."
        previous_sender = "__system__"

        for turn in range(self._scenario.turns):
            active_agent = self._agents[turn % len(self._agents)]

            if turn == 0:
                setup_data = self._scenario.setup.get(active_agent.name, {})
                if isinstance(setup_data, dict) and setup_data:
                    content = (
                        f"Begin the interaction. Your setup context: {setup_data}"
                    )
                elif isinstance(setup_data, str):
                    content = setup_data
                else:
                    content = "Begin the interaction."
            else:
                content = previous_response_content

            msg = Message(
                sender=previous_sender,
                receiver=active_agent.name,
                content=content,
                turn=turn,
                timestamp=time.time(),
            )

            response = active_agent.receive(msg)
            logger.debug("Turn %d: %s → %s", turn, active_agent.name, response.content[:80])

            # Record the agent's outgoing response as the message event.
            # Receiver is the next agent in round-robin (or __system__ on the last turn).
            if len(self._agents) > 1:
                next_agent = self._agents[(turn + 1) % len(self._agents)]
                receiver_name = next_agent.name
            else:
                receiver_name = "__system__"

            trace.add_event(
                TraceEvent(
                    type="message",
                    turn=turn,
                    agent=active_agent.name,
                    data={
                        "sender": active_agent.name,
                        "receiver": receiver_name,
                        "content": response.content,
                        "metadata": response.metadata,
                    },
                    timestamp=time.time(),
                )
            )

            state = active_agent.get_state()
            trace.add_event(
                TraceEvent(
                    type="state_change",
                    turn=turn,
                    agent=active_agent.name,
                    data={"state": state},
                    timestamp=time.time(),
                )
            )

            previous_response_content = response.content
            previous_sender = active_agent.name

        for agent in self._agents:
            agent.teardown()

        self._run_property_checks(trace)
        return trace

    def _run_property_checks(self, trace: Trace) -> None:
        """Execute all declared property checkers and attach results to the trace."""
        if not self._scenario.assertions:
            return

        import agentqa.properties  # noqa: F401 — triggers self-registration of all checkers
        from agentqa.properties.base import registry

        for prop_config in self._scenario.assertions:
            try:
                checker = registry.get(prop_config.name)
            except KeyError as exc:
                logger.warning("Skipping unknown property checker: %s", exc)
                continue

            result = checker.check(trace, self._scenario, prop_config.params)
            trace.results.append(result)
            trace.add_event(
                TraceEvent(
                    type="property_check",
                    turn=-1,
                    agent=None,
                    data={
                        "property_name": result.property_name,
                        "passed": result.passed,
                        "details": result.details,
                    },
                    timestamp=time.time(),
                )
            )

    def run(self, n: int | None = None) -> list[Trace]:
        """Run the simulation n times and return all traces.

        Args:
            n: Number of runs. Defaults to scenario.runs.
        """
        count = n if n is not None else self._scenario.runs
        traces = []
        for i in range(count):
            logger.info("Starting run %d/%d for scenario '%s'", i + 1, count, self._scenario.name)
            trace = self.run_once()
            traces.append(trace)
        return traces

    def summarize(self, traces: list[Trace]) -> "RunSummary":
        """Compute aggregate statistics across all runs."""
        from agentqa.engine import RunSummary, PropertyStats  # local import to avoid circularity

        property_names: set[str] = set()
        for trace in traces:
            for result in trace.results:
                property_names.add(result.property_name)

        property_results: dict[str, PropertyStats] = {}
        for prop_name in property_names:
            passes = 0
            failures = 0
            failure_details: list[str] = []
            for i, trace in enumerate(traces):
                for result in trace.results:
                    if result.property_name == prop_name:
                        if result.passed:
                            passes += 1
                        else:
                            failures += 1
                            failure_details.append(f"Run {i + 1}: FAILED — {result.details}")
            total = passes + failures
            property_results[prop_name] = PropertyStats(
                passes=passes,
                failures=failures,
                pass_rate=passes / total if total > 0 else 0.0,
                failure_details=failure_details,
            )

        return RunSummary(
            scenario_name=self._scenario.name,
            total_runs=len(traces),
            property_results=property_results,
        )


from pydantic import BaseModel  # noqa: E402 — kept at bottom to avoid polluting top-level imports


class PropertyStats(BaseModel):
    """Aggregate statistics for one property across all runs."""

    passes: int
    failures: int
    pass_rate: float
    failure_details: list[str]


class RunSummary(BaseModel):
    """Aggregate results for a full multi-run scenario execution."""

    scenario_name: str
    total_runs: int
    property_results: dict[str, PropertyStats]
