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
@click.option("--save-traces", is_flag=True, help="Save JSONL traces to .agentqa/traces/.")
@click.option("--view", "open_viewer", is_flag=True, help="Open an interactive HTML viewer for the first trace after the run.")
@click.option("--verbose", is_flag=True, help="Enable debug output.")
def run(
    path: str,
    runs: int | None,
    agents_file: str | None,
    threshold: float,
    thorough: bool,
    save_traces: bool,
    open_viewer: bool,
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

        # Save traces to disk when requested (or when --view needs them).
        saved_paths: list[Path] = []
        if save_traces or open_viewer:
            trace_dir = Path(".agentqa") / "traces"
            trace_dir.mkdir(parents=True, exist_ok=True)
            for i, trace in enumerate(traces):
                dest = trace_dir / f"{scenario.name}_run_{i + 1}.jsonl"
                trace.to_jsonl(dest)
                saved_paths.append(dest)
            click.echo(f"  Saved {len(saved_paths)} trace(s) → {trace_dir}/")

        summary = engine.summarize(traces)

        # Open the interactive HTML viewer for the first trace.
        if open_viewer and saved_paths:
            import webbrowser
            from agentqa.export import export_html

            html_path = saved_paths[0].with_suffix(".html")
            export_html(
                traces[0],
                html_path,
                title=scenario.name,
                run_summary=summary,
                all_traces=traces,
            )
            click.echo(f"  Viewer → {html_path}")
            webbrowser.open(html_path.resolve().as_uri())

        failed = print_summary(summary, threshold=threshold)
        if failed:
            any_failure = True

    sys.exit(1 if any_failure else 0)


@main.command()
@click.argument("trace_path", type=click.Path(exists=True))
@click.option("--format", "fmt", default="html", type=click.Choice(["html", "mast"]), show_default=True,
              help="Export format: 'html' for a self-contained static page, 'mast' for MAST annotation JSONL.")
@click.option("--output", "-o", default=None, type=click.Path(), help="Output file path. Defaults to <trace>.html or <trace>.mast.jsonl.")
@click.option("--title", default="AgentQA Trace", show_default=True, help="Title for HTML exports.")
def export(trace_path: str, fmt: str, output: str | None, title: str) -> None:
    """Export a trace JSONL to a human-readable or tool-compatible format."""
    from agentqa.trace import Trace
    from agentqa.export import export_html, export_mast

    src = Path(trace_path)
    trace = Trace.from_jsonl(src)

    if output:
        dest = Path(output)
    elif fmt == "html":
        dest = src.with_suffix(".html")
    else:
        dest = src.with_suffix(".mast.jsonl")

    if fmt == "html":
        export_html(trace, dest, title=title)
    else:
        export_mast(trace, dest)

    click.echo(f"Exported {fmt} → {dest}")


@main.command()
@click.argument("trace_path", type=click.Path(exists=True))
@click.option("--output", "-o", default=None, type=click.Path(), help="Output HTML file. Defaults to <trace>.html.")
@click.option("--title", default=None, help="Page title (defaults to the trace filename).")
@click.option("--no-open", is_flag=True, help="Write the file but do not open it in a browser.")
def view(trace_path: str, output: str | None, title: str | None, no_open: bool) -> None:
    """Export a trace JSONL to an interactive HTML viewer and open it."""
    import webbrowser
    from agentqa.trace import Trace
    from agentqa.export import export_html

    src = Path(trace_path)
    dest = Path(output) if output else src.with_suffix(".html")
    label = title or src.stem

    trace = Trace.from_jsonl(src)
    export_html(trace, dest, title=label)
    click.echo(f"Viewer → {dest}")

    if not no_open:
        webbrowser.open(dest.resolve().as_uri())


@main.command("diff")
@click.argument("trace_a", type=click.Path(exists=True))
@click.argument("trace_b", type=click.Path(exists=True))
@click.option("--output", "-o", default=None, type=click.Path(), help="Output HTML file.")
@click.option("--title-a", default=None, help="Label for the first trace.")
@click.option("--title-b", default=None, help="Label for the second trace.")
@click.option("--no-open", is_flag=True, help="Write the file but do not open it in a browser.")
def diff_cmd(
    trace_a: str,
    trace_b: str,
    output: str | None,
    title_a: str | None,
    title_b: str | None,
    no_open: bool,
) -> None:
    """Open a side-by-side diff of two trace JSONL files."""
    import webbrowser
    from agentqa.trace import Trace
    from agentqa.export import diff_html

    src_a = Path(trace_a)
    src_b = Path(trace_b)
    dest = Path(output) if output else src_a.with_name(f"{src_a.stem}_vs_{src_b.stem}.html")
    label_a = title_a or src_a.stem
    label_b = title_b or src_b.stem

    t_a = Trace.from_jsonl(src_a)
    t_b = Trace.from_jsonl(src_b)
    diff_html(t_a, t_b, dest, title_a=label_a, title_b=label_b)
    click.echo(f"Diff viewer → {dest}")

    if not no_open:
        webbrowser.open(dest.resolve().as_uri())


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False))
@click.option("--output", "-o", default=None, type=click.Path(), help="Output HTML file.")
@click.option("--title", default="AgentQA Dashboard", show_default=True)
@click.option("--no-open", is_flag=True, help="Write the file but do not open it in a browser.")
def dashboard(directory: str, output: str | None, title: str, no_open: bool) -> None:
    """Build an aggregate dashboard from all trace JSONL files in DIRECTORY."""
    import webbrowser
    from agentqa.trace import Trace
    from agentqa.export import dashboard_html

    src = Path(directory)
    jsonl_files = sorted(src.glob("**/*.jsonl"))
    if not jsonl_files:
        click.echo(f"No .jsonl trace files found in: {directory}", err=True)
        sys.exit(1)

    traces: list[tuple[str, Trace]] = []
    for p in jsonl_files:
        try:
            traces.append((p.stem, Trace.from_jsonl(p)))
        except Exception as exc:
            click.echo(f"  Skipping {p.name}: {exc}", err=True)

    if not traces:
        click.echo("No valid traces loaded.", err=True)
        sys.exit(1)

    dest = Path(output) if output else src / "dashboard.html"
    dashboard_html(traces, dest, title=title)
    click.echo(f"Dashboard → {dest} ({len(traces)} scenarios)")

    if not no_open:
        webbrowser.open(dest.resolve().as_uri())


@main.command()
@click.argument("trace_path", type=click.Path(exists=True))
@click.option("--scenario", "scenario_path", required=True, type=click.Path(exists=True),
              help="Scenario YAML file whose assertions should be replayed.")
@click.option("--up-to-turn", default=None, type=int,
              help="Only replay events up to (and including) this turn number.")
@click.option("--verbose", is_flag=True, help="Enable debug output.")
def replay(
    trace_path: str,
    scenario_path: str,
    up_to_turn: int | None,
    verbose: bool,
) -> None:
    """Replay property checks against a previously recorded TRACE_PATH (JSONL)."""
    if verbose:
        logging.basicConfig(level=logging.DEBUG)

    from agentqa.scenario import load_scenario
    from agentqa.replay import ReplayEngine

    scenario = load_scenario(Path(scenario_path))
    engine = ReplayEngine.from_jsonl(Path(trace_path), scenario)
    results = engine.replay(up_to_turn=up_to_turn)

    if not results:
        click.echo("No assertions declared in scenario — nothing to replay.")
        return

    any_failure = False
    for result in results:
        status = click.style("PASS", fg="green") if result.passed else click.style("FAIL", fg="red")
        click.echo(f"  [{status}] {result.property_name}: {result.details}")
        if not result.passed:
            any_failure = True

    sys.exit(1 if any_failure else 0)


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False), default=".")
@click.option("--framework", type=click.Choice(["crewai", "langgraph", "autogen"]),
              default=None, help="Force a specific framework scanner instead of auto-detecting.")
@click.option("--output", "-o", default=None, type=click.Path(),
              help="Output directory for generated files. Defaults to DIRECTORY.")
@click.option("--force", is_flag=True, help="Overwrite existing scenario.yaml and agents.py.")
@click.option("--verbose", is_flag=True, help="Enable debug output.")
def init(
    directory: str,
    framework: str | None,
    output: str | None,
    force: bool,
    verbose: bool,
) -> None:
    """Scan a project for multi-agent code and generate a starter test scenario.

    Detects CrewAI, LangGraph, or AutoGen agent definitions via AST parsing,
    then generates a scenario.yaml and agents.py scaffold with smart defaults.

    \b
    Examples:
      agentqa init                       # scan current directory
      agentqa init ./my_project          # scan a specific directory
      agentqa init . --framework crewai  # force CrewAI scanner
      agentqa init . -o tests/           # write files to tests/
    """
    if verbose:
        logging.basicConfig(level=logging.DEBUG)

    from agentqa.scanner import scan_project
    from agentqa.scaffold import generate_scenario_yaml, generate_agents_py

    src_dir = Path(directory)
    out_dir = Path(output) if output else src_dir

    # Check for existing files
    scenario_dest = out_dir / "scenario.yaml"
    agents_dest = out_dir / "agents.py"

    if not force:
        existing = []
        if scenario_dest.exists():
            existing.append(str(scenario_dest))
        if agents_dest.exists():
            existing.append(str(agents_dest))
        if existing:
            click.echo(
                f"Files already exist: {', '.join(existing)}\n"
                f"Use --force to overwrite, or -o to write to a different directory.",
                err=True,
            )
            sys.exit(1)

    # Scan the project
    click.echo(f"Scanning {src_dir.resolve()} for multi-agent framework code...")

    result = scan_project(src_dir, framework=framework)

    if result is None:
        click.echo(
            "\nNo multi-agent framework detected.\n\n"
            "AgentQA looks for:\n"
            "  • CrewAI   — Agent(), Crew(), @CrewBase classes\n"
            "  • LangGraph — StateGraph, add_node(), add_edge()\n"
            "  • AutoGen  — AssistantAgent, ConversableAgent, GroupChat\n\n"
            "If your agents use a different framework, you can write scenarios manually.\n"
            "See: agentqa run examples/annotated/01_getting_started.yaml --view",
            err=True,
        )
        sys.exit(1)

    # Report what we found
    click.echo(f"\n  Framework: {click.style(result.framework, fg='cyan', bold=True)}")
    click.echo(f"  Source:    {result.entry_file}")
    click.echo(f"  Agents:    {len(result.agents)} found\n")

    for i, agent in enumerate(result.agents):
        role_str = f" — {agent.role[:60]}..." if agent.role and len(agent.role) > 60 else f" — {agent.role}" if agent.role else ""
        click.echo(f"    {i + 1}. {click.style(agent.name, bold=True)}{role_str}")

    if result.edges:
        click.echo(f"\n  Topology ({len(result.edges)} edges):")
        for edge in result.edges:
            click.echo(f"    {edge.source} → {edge.target}")

    # Generate files
    out_dir.mkdir(parents=True, exist_ok=True)
    scenario_path = generate_scenario_yaml(result, out_dir)
    agents_path = generate_agents_py(result, out_dir)

    click.echo(f"\n  Generated: {click.style(str(scenario_path), fg='green')}")
    click.echo(f"  Generated: {click.style(str(agents_path), fg='green')}")

    click.echo(f"\n{click.style('Next steps:', bold=True)}")
    click.echo(f"  1. Edit {agents_path.name} to import your real agents")
    click.echo(f"  2. Add private data to scenario.yaml 'setup' section")
    click.echo(f"  3. Run your first test:\n")
    click.echo(f"     {click.style(f'agentqa run {scenario_path} --view', fg='cyan')}\n")


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
