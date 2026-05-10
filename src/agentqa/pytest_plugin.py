from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import pytest

from agentqa.scenario import ScenarioConfig, load_scenario


def pytest_collect_file(parent: pytest.Collector, file_path: Path) -> pytest.Collector | None:
    """Collect .yaml files that contain an 'agents' key as AgentQA test items."""
    if file_path.suffix not in (".yaml", ".yml"):
        return None

    try:
        import yaml

        with file_path.open() as fh:
            raw = yaml.safe_load(fh)
        if not isinstance(raw, dict) or "agents" not in raw:
            return None
    except Exception:
        return None

    return ScenarioFile.from_parent(parent, path=file_path)


class ScenarioFile(pytest.File):
    """A pytest collector that yields one ScenarioItem per YAML scenario file."""

    def collect(self) -> Any:
        scenario = load_scenario(self.path)
        yield ScenarioItem.from_parent(self, name=scenario.name, scenario=scenario)


class ScenarioItem(pytest.Item):
    """A single pytest test item representing one AgentQA scenario."""

    def __init__(self, *, scenario: ScenarioConfig, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.scenario = scenario

    def runtest(self) -> None:
        """Load agents, run simulation, assert all properties pass."""
        if self.scenario.agents_file:
            agents_path = self.path.parent / self.scenario.agents_file
        else:
            agents_path = self.path.parent / "agents.py"
        if not agents_path.exists():
            pytest.skip(f"No agents file found next to {self.path.name}")

        agents_module = _load_agents_module(agents_path)
        agent_instances = [
            agents_module[a.name]
            for a in self.scenario.agents
            if a.name in agents_module
        ]

        from agentqa.engine import SimulationEngine

        engine = SimulationEngine(agent_instances, self.scenario)
        traces = engine.run()
        summary = engine.summarize(traces)

        failures: list[str] = []
        for prop_name, stats in summary.property_results.items():
            if stats.pass_rate < 1.0:
                failures.append(
                    f"{prop_name}: {stats.passes}/{stats.passes + stats.failures} passed "
                    f"({stats.pass_rate * 100:.1f}%) — "
                    + "; ".join(stats.failure_details[:3])
                )

        if failures:
            raise AgentQAAssertionError("\n".join(failures))

    def repr_failure(self, excinfo: Any) -> str:  # type: ignore[override]
        if isinstance(excinfo.value, AgentQAAssertionError):
            return f"AgentQA scenario FAILED:\n{excinfo.value}"
        return super().repr_failure(excinfo)

    def reportinfo(self) -> tuple[Any, int | None, str]:
        return self.path, None, f"agentqa: {self.scenario.name}"


class AgentQAAssertionError(Exception):
    """Raised when one or more property checks fail in a pytest run."""


def _load_agents_module(agents_path: Path) -> dict:
    spec = importlib.util.spec_from_file_location("_agentqa_agents", agents_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load: {agents_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    if not hasattr(module, "agents"):
        raise AttributeError(f"'{agents_path}' must define a top-level 'agents' dict.")
    return module.agents
