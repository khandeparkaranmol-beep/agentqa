from __future__ import annotations

import click

from agentqa.trace import Trace


def print_trace(trace: Trace, scenario_name: str, run_number: int) -> None:
    """Print a human-readable view of one simulation run."""
    click.echo(f"\n{'=' * 60}")
    click.echo(f"  {scenario_name} — Run {run_number}")
    click.echo(f"{'=' * 60}")

    for event in trace.get_messages():
        sender = event.data.get("sender", event.agent or "?")
        receiver = event.data.get("receiver", "?")
        content = event.data.get("content", "")
        click.echo(f"\n[Turn {event.turn}] {sender} → {receiver}:")
        click.echo(f'  "{content}"')

    cost = trace.cost_summary()
    if cost.total_input_tokens or cost.total_output_tokens or cost.total_cost_usd:
        click.echo(
            f"\nCost: {cost.total_input_tokens} in / {cost.total_output_tokens} out tokens"
            + (f"  (${cost.total_cost_usd:.4f})" if cost.total_cost_usd else "")
        )

    if trace.results:
        click.echo("\nProperties:")
        for result in trace.results:
            icon = click.style("✓", fg="green") if result.passed else click.style("✗", fg="red")
            status = "passed" if result.passed else "FAILED"
            click.echo(f"  {icon} {result.property_name} — {status}: {result.details}")
            if not result.passed and result.evidence:
                for ev in result.evidence:
                    content = ev.data.get("content", "")
                    click.echo(f"    Evidence [Turn {ev.turn}]: {content[:120]}")


def print_summary(summary: "RunSummary", threshold: float = 1.0) -> bool:  # type: ignore[name-defined]  # noqa: F821
    """Print aggregate statistics. Returns True if any property failed threshold.

    Args:
        summary: RunSummary from SimulationEngine.summarize().
        threshold: Minimum pass_rate for a property to count as passing.

    Returns:
        True if the overall result is a failure (any property below threshold).
    """
    from agentqa.engine import RunSummary  # avoid circular at module level

    click.echo(f"\n{'=' * 60}")
    click.echo(f"  Results: {summary.scenario_name} ({summary.total_runs} runs)")
    click.echo(f"{'=' * 60}\n")

    any_failed = False

    for prop_name, stats in summary.property_results.items():
        passing = stats.pass_rate >= threshold
        if not passing:
            any_failed = True

        color = "green" if passing else ("yellow" if stats.pass_rate > 0 else "red")
        label = "✓" if passing else ("✗ FLAKY" if stats.pass_rate > 0 else "✗")
        line = (
            f"{prop_name}: {stats.passes}/{stats.passes + stats.failures} passed "
            f"({stats.pass_rate * 100:.1f}%) "
        )
        click.echo(click.style(line, fg=color) + click.style(label, fg=color))

        for detail in stats.failure_details:
            click.echo(f"  {detail}")
        click.echo()

    total_props = len(summary.property_results)
    passing_props = sum(
        1 for s in summary.property_results.values() if s.pass_rate >= threshold
    )

    overall_color = "green" if not any_failed else "red"
    overall_label = "PASS" if not any_failed else "FAIL"
    click.echo(
        click.style(
            f"Overall: {passing_props}/{total_props} properties passed consistently. {overall_label}.",
            fg=overall_color,
            bold=True,
        )
    )

    return any_failed
