from __future__ import annotations

import logging
import sys
from pathlib import Path

import click

from agentqa import __version__


@click.group()
@click.version_option(version=__version__, prog_name="agentqa")
def main() -> None:
    """AgentQA — multi-agent interaction testing framework."""


@main.command()
@click.argument("path", type=click.Path(exists=True))
@click.option("--runs", default=None, type=int, help="Override scenario run count.")
@click.option("--agents", "agents_file", default=None, type=click.Path(), help="Python file exporting an 'agents' dict. Defaults to agents.py in the scenario directory.")
@click.option("--threshold", default=1.0, type=float, show_default=True, help="Minimum pass rate (0-1) for a property to be considered passing.")
@click.option("--thorough", is_flag=True, help="Shorthand for --runs 20.")
@click.option("--verbose", is_flag=True, help="Enable debug output.")
def run(
    path: str,
    runs: int | None,
    agents_file: str | None,
    threshold: float,
    thorough: bool,
    verbose: bool,
) -> None:
    """Run scenarios from PATH (file or directory)."""
    if verbose:
        logging.basicConfig(level=logging.DEBUG)

    if thorough:
        runs = 20

    scenario_paths = _collect_scenario_paths(Path(path))
    if not scenario_paths:
        click.echo(f"No scenario files found at: {path}", err=True)
        sys.exit(1)

    from agentqa.scenario import load_scenario

    any_failure = False
    for scenario_path in scenario_paths:
        scenario = load_scenario(scenario_path)

        if runs is not None:
            scenario = scenario.model_copy(update={"runs": runs})

        agents_path = _resolve_agents_file(scenario_path, agents_file or scenario.agents_file)

        if agents_path is None or not agents_path.exists():
            click.echo(
                f"[{scenario.name}] Loaded scenario ({scenario.turns} turns, "
                f"{scenario.runs} runs, {len(scenario.agents)} agents). "
                f"No agents file found — skipping execution."
            )
            click.echo(f"  Agents: {[a.name for a in scenario.agents]}")
            continue

        agents = _load_agents(agents_path)

        from agentqa.engine import SimulationEngine
        from agentqa.display import print_trace, print_summary

        agent_list = [agents[a.name] for a in scenario.agents if a.name in agents]
        engine = SimulationEngine(agent_list, scenario)
        traces = engine.run()

        for i, trace in enumerate(traces):
            print_trace(trace, scenario.name, i + 1)

        summary = engine.summarize(traces)
        failed = print_summary(summary, threshold=threshold)
        if failed:
            any_failure = True

    sys.exit(1 if any_failure else 0)


def _collect_scenario_paths(path: Path) -> list[Path]:
    """Return scenario file paths from a file or directory."""
    if path.is_file():
        return [path]
    return sorted(path.glob("**/*.yaml")) + sorted(path.glob("**/*.yml"))


def _resolve_agents_file(scenario_path: Path, agents_file: str | None) -> Path | None:
    """Find the agents.py file to use for this scenario."""
    if agents_file:
        p = Path(agents_file)
        # Relative paths are resolved from the scenario's directory.
        if not p.is_absolute():
            p = scenario_path.parent / p
        return p
    return scenario_path.parent / "agents.py"


def _load_agents(agents_path: Path) -> dict:
    """Import a Python file and return its 'agents' dict."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("_agentqa_agents", agents_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load agents file: {agents_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]

    if not hasattr(module, "agents"):
        raise AttributeError(
            f"agents file '{agents_path}' must define a top-level 'agents' dict "
            "mapping agent names to AgentUnderTest instances."
        )
    return module.agents
