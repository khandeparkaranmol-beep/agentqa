from __future__ import annotations

import json
from pathlib import Path

from agentqa.trace import Trace
from agentqa.topology import topology_summary


def export_mast(trace: Trace, path: Path) -> None:
    """Export a trace in MAST-compatible annotation format.

    The MAST format (Cemri et al., NeurIPS 2025) represents each interaction
    turn as a JSON object with standardised fields for failure mode annotation.
    Exporting to this format allows teams to use MAST's annotation pipeline
    and categorisation tools on their AgentQA traces.

    Output: one JSON object per line (JSONL), compatible with MAST's
    annotation pipeline input schema.

    Args:
        trace: The completed Trace to export.
        path: Output file path (conventionally *.mast.jsonl).
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    topo = topology_summary(trace)
    messages = trace.get_messages()
    property_events = [e for e in trace.events if e.type == "property_check"]

    with path.open("w") as fh:
        # Header record with scenario-level metadata
        header = {
            "record_type": "trace_header",
            "agentqa_version": _get_version(),
            "topology": topo["topology"],
            "agent_count": topo["agents"],
            "total_turns": len(messages),
            "unique_edges": topo["unique_edges"],
        }
        fh.write(json.dumps(header) + "\n")

        # One record per message turn
        for event in messages:
            record = {
                "record_type": "interaction",
                "turn": event.turn,
                "sender": event.data.get("sender", ""),
                "receiver": event.data.get("receiver", ""),
                "content": event.data.get("content", ""),
                "timestamp": event.timestamp,
                "input_tokens": event.input_tokens,
                "output_tokens": event.output_tokens,
                "cost_usd": event.cost_usd,
                # MAST annotation fields — left for human/LLM annotators
                "failure_mode": None,
                "failure_category": None,
                "annotator_notes": None,
            }
            fh.write(json.dumps(record) + "\n")

        # Property check results as annotation records
        for event in property_events:
            record = {
                "record_type": "property_check",
                "property_name": event.data.get("property_name", ""),
                "passed": event.data.get("passed", None),
                "details": event.data.get("details", ""),
                "turn": event.turn,
                "is_milestone": event.data.get("is_milestone", False),
            }
            fh.write(json.dumps(record) + "\n")


def export_html(trace: Trace, path: Path, title: str = "AgentQA Trace") -> None:
    """Export a trace as a self-contained static HTML file.

    Produces a human-readable, shareable HTML page showing all messages
    as a conversation timeline with property check results annotated.
    No server required — the file works when opened directly in a browser.

    Args:
        trace: The completed Trace to export.
        path: Output file path (conventionally *.html).
        title: Page title shown in the browser tab and header.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    topo = topology_summary(trace)
    messages = trace.get_messages()
    cost = trace.cost_summary()
    property_events = [
        e for e in trace.events
        if e.type == "property_check" and not e.data.get("is_milestone")
    ]
    milestone_events = [
        e for e in trace.events
        if e.type == "property_check" and e.data.get("is_milestone")
    ]

    # Build message rows
    msg_rows = ""
    for event in messages:
        sender = event.data.get("sender", "?")
        receiver = event.data.get("receiver", "?")
        content = _escape(event.data.get("content", ""))
        msg_rows += (
            f'<div class="message">'
            f'<span class="turn">[Turn {event.turn}]</span> '
            f'<span class="sender">{_escape(sender)}</span> → '
            f'<span class="receiver">{_escape(receiver)}</span>'
            f'<div class="content">{content}</div>'
            f"</div>\n"
        )

    # Build property rows
    prop_rows = ""
    for event in property_events:
        passed = event.data.get("passed", True)
        icon = "✓" if passed else "✗"
        cls = "pass" if passed else "fail"
        name = _escape(event.data.get("property_name", ""))
        details = _escape(event.data.get("details", ""))
        prop_rows += (
            f'<div class="prop {cls}">'
            f'<span class="icon">{icon}</span> '
            f'<strong>{name}</strong>: {details}'
            f"</div>\n"
        )

    # Build milestone rows
    ms_rows = ""
    for event in milestone_events:
        passed = event.data.get("passed", True)
        icon = "✓" if passed else "✗"
        cls = "pass" if passed else "fail"
        name = _escape(event.data.get("property_name", "").removeprefix("milestone:"))
        details = _escape(event.data.get("details", ""))
        ms_rows += (
            f'<div class="prop {cls}">'
            f'<span class="icon">{icon}</span> '
            f'<strong>{name}</strong>: {details}'
            f"</div>\n"
        )

    cost_line = ""
    if cost.total_input_tokens or cost.total_cost_usd:
        cost_line = (
            f"<p><strong>Cost:</strong> {cost.total_input_tokens} in / "
            f"{cost.total_output_tokens} out tokens"
            + (f" (${cost.total_cost_usd:.4f})" if cost.total_cost_usd else "")
            + "</p>"
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_escape(title)}</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #222; }}
  h1 {{ font-size: 1.4rem; margin-bottom: 4px; }}
  .meta {{ color: #666; font-size: 0.9rem; margin-bottom: 24px; }}
  .message {{ background: #f7f7f7; border-left: 3px solid #ccc; margin: 8px 0; padding: 10px 14px; border-radius: 0 4px 4px 0; }}
  .turn {{ color: #888; font-size: 0.85rem; }}
  .sender {{ font-weight: 600; color: #1a73e8; }}
  .receiver {{ font-weight: 600; color: #e37400; }}
  .content {{ margin-top: 6px; font-size: 0.95rem; white-space: pre-wrap; }}
  h2 {{ font-size: 1.1rem; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }}
  .prop {{ padding: 8px 12px; margin: 4px 0; border-radius: 4px; font-size: 0.92rem; }}
  .prop.pass {{ background: #e6f4ea; border-left: 3px solid #34a853; }}
  .prop.fail {{ background: #fce8e6; border-left: 3px solid #ea4335; }}
  .icon {{ font-size: 1rem; margin-right: 4px; }}
  footer {{ margin-top: 40px; font-size: 0.8rem; color: #aaa; }}
</style>
</head>
<body>
<h1>{_escape(title)}</h1>
<div class="meta">
  {len(messages)} turns &middot; {topo['agents']} agents &middot; topology: <strong>{topo['topology']}</strong>
  {cost_line}
</div>

<h2>Interaction</h2>
{msg_rows}

{"<h2>Properties</h2>" + prop_rows if prop_rows else ""}
{"<h2>Milestones</h2>" + ms_rows if ms_rows else ""}

<footer>Generated by <a href="https://github.com/khandeparkaranmol-beep/agentqa">AgentQA</a> {_get_version()}</footer>
</body>
</html>"""

    path.write_text(html, encoding="utf-8")


def _escape(text: str) -> str:
    """Minimal HTML escaping."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
    )


def _get_version() -> str:
    try:
        from agentqa import __version__
        return __version__
    except ImportError:
        return "unknown"
