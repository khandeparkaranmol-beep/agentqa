from __future__ import annotations

import logging
from pathlib import Path

from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent

logger = logging.getLogger(__name__)


class ReplayEngine:
    """Re-run property checks against a previously recorded trace.

    Replay is useful when you want to:
    - Apply new or updated property checkers to old trace data without
      re-running the (potentially expensive) agents.
    - Inspect a snapshot saved mid-run.
    - Debug a failing scenario by replaying the exact message sequence.

    Usage::

        engine = ReplayEngine.from_jsonl(Path("traces/run_001.jsonl"), scenario)
        results = engine.replay()
        for result in results:
            print(result.property_name, "PASS" if result.passed else "FAIL")
    """

    def __init__(self, trace: Trace, scenario: ScenarioConfig) -> None:
        self._trace = trace
        self._scenario = scenario

    @classmethod
    def from_jsonl(cls, path: Path, scenario: ScenarioConfig) -> ReplayEngine:
        """Load a trace from a JSONL file and prepare it for replay.

        Args:
            path: Path to the JSONL trace file.
            scenario: The scenario config that declares which properties to check.
        """
        trace = Trace.from_jsonl(path)
        return cls(trace, scenario)

    def replay(self, up_to_turn: int | None = None) -> list:
        """Execute all declared property checks against the recorded trace.

        Args:
            up_to_turn: If provided, only events up to (and including) this turn
                are considered. Useful for partial-trace debugging.

        Returns:
            List of ``PropertyResult`` objects (one per declared assertion).
        """
        import agentqa.properties  # noqa: F401 — triggers self-registration
        from agentqa.properties.base import registry

        if up_to_turn is not None:
            working_trace = self._trace.snapshot(up_to_turn)
        else:
            working_trace = self._trace

        results = []
        for prop_config in self._scenario.assertions:
            try:
                checker = registry.get(prop_config.name)
            except KeyError as exc:
                logger.warning("Skipping unknown property checker during replay: %s", exc)
                continue

            result = checker.check(working_trace, self._scenario, prop_config.params)
            results.append(result)
            logger.debug(
                "Replay: %s → %s", result.property_name, "PASS" if result.passed else "FAIL"
            )

        return results

    @property
    def trace(self) -> Trace:
        """The underlying recorded trace."""
        return self._trace
