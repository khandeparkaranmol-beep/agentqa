from __future__ import annotations

import json
from pathlib import Path

from agentqa.trace import Trace
from agentqa.topology import topology_summary

_VIEWER_TEMPLATE = Path(__file__).parent / "viewer" / "index.html"
_DATA_PLACEHOLDER = "</head>"


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
    """Export a trace as a self-contained interactive HTML file (React viewer).

    Embeds the prebuilt React swimlane viewer with the trace data injected at
    ``window.__AGENTQA_DATA__``. The output is a single portable file that
    works when opened directly in any modern browser — no server required.

    Falls back to a basic HTML template if the React bundle is not present
    (e.g. a developer checkout that hasn't run ``npm run build``).

    Args:
        trace: The completed Trace to export.
        path: Output file path (conventionally *.html).
        title: Page title shown in the browser tab and header.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    topo = topology_summary(trace)

    property_results = [
        {
            "property_name": e.data.get("property_name", ""),
            "passed": bool(e.data.get("passed", True)),
            "details": e.data.get("details", ""),
            "turn": e.turn if e.turn >= 0 else None,
        }
        for e in trace.events
        if e.type == "property_check" and not e.data.get("is_milestone")
    ]

    data: dict = {
        "mode": "trace",
        "title": title,
        "topology": topo["topology"],
        "agentqa_version": _get_version(),
        "events": [e.model_dump() for e in trace.events],
        "results": property_results,
    }

    _write_viewer_html(data, title, path)


def diff_html(
    trace_a: Trace,
    trace_b: Trace,
    path: Path,
    title_a: str = "Run A",
    title_b: str = "Run B",
) -> None:
    """Export a side-by-side diff of two traces as a self-contained HTML file.

    Uses the React viewer in diff mode, showing both traces turn-by-turn with
    differences highlighted. Useful for comparing baseline vs. fault-injected
    runs, or two different agent configurations.

    Args:
        trace_a: First trace (left column).
        trace_b: Second trace (right column).
        path: Output file path.
        title_a: Label for the first trace.
        title_b: Label for the second trace.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    def _results(t: Trace) -> list[dict]:
        return [
            {
                "property_name": e.data.get("property_name", ""),
                "passed": bool(e.data.get("passed", True)),
                "details": e.data.get("details", ""),
                "turn": e.turn if e.turn >= 0 else None,
            }
            for e in t.events
            if e.type == "property_check" and not e.data.get("is_milestone")
        ]

    data: dict = {
        "mode": "diff",
        "title": title_a,
        "title_b": title_b,
        "agentqa_version": _get_version(),
        "events": [e.model_dump() for e in trace_a.events],
        "results": _results(trace_a),
        "trace_b": [e.model_dump() for e in trace_b.events],
        "results_b": _results(trace_b),
    }

    _write_viewer_html(data, f"Diff: {title_a} vs {title_b}", path)


def dashboard_html(
    traces: list[tuple[str, Trace]],
    path: Path,
    title: str = "AgentQA Dashboard",
) -> None:
    """Export an aggregate dashboard across multiple named traces.

    Renders the React viewer in dashboard mode with one ``ScenarioSummary``
    entry per trace.  Pass rates are computed from property_check events.

    Args:
        traces: List of (name, trace) pairs, one per scenario/run.
        path: Output file path.
        title: Dashboard page title.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    scenarios: list[dict] = []
    for name, trace in traces:
        topo = topology_summary(trace)
        props: dict[str, dict] = {}
        milestones: dict[str, dict] = {}

        for e in trace.events:
            if e.type != "property_check":
                continue
            prop_name: str = e.data.get("property_name", "")
            passed = bool(e.data.get("passed", True))
            is_ms = bool(e.data.get("is_milestone", False))
            bucket = milestones if is_ms else props
            if prop_name not in bucket:
                bucket[prop_name] = {"passes": 0, "failures": 0, "pass_rate": 0.0}
            bucket[prop_name]["passes" if passed else "failures"] += 1

        for bucket in (props, milestones):
            for rec in bucket.values():
                total = rec["passes"] + rec["failures"]
                rec["pass_rate"] = rec["passes"] / total if total else 1.0

        scenarios.append({
            "name": name,
            "total_runs": 1,
            "topology": topo["topology"],
            "properties": props,
            "milestones": milestones,
        })

    data: dict = {
        "mode": "dashboard",
        "title": title,
        "agentqa_version": _get_version(),
        "events": [],
        "results": [],
        "scenarios": scenarios,
    }
    _write_viewer_html(data, title, path)


def _write_viewer_html(data: dict, title: str, path: Path) -> None:
    """Inject data into the React bundle and write to path.

    Inserts a ``<script>`` tag that assigns the JSON payload to
    ``window.__AGENTQA_DATA__`` immediately before ``</head>`` so the React
    app can read it on load.  If the prebuilt bundle is missing, falls back to
    a minimal text-only HTML page.
    """
    if not _VIEWER_TEMPLATE.exists():
        _write_fallback_html(data, title, path)
        return

    template = _VIEWER_TEMPLATE.read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False)
    injection = f"<script>window.__AGENTQA_DATA__={payload};</script>"
    html = template.replace(_DATA_PLACEHOLDER, injection + "\n" + _DATA_PLACEHOLDER, 1)
    path.write_text(html, encoding="utf-8")


def _write_fallback_html(data: dict, title: str, path: Path) -> None:
    """Minimal HTML fallback used when the React bundle has not been built."""
    events = data.get("events", [])
    messages = [e for e in events if e.get("type") == "message"]
    msg_rows = ""
    for e in messages:
        sender = _escape(e.get("data", {}).get("sender", "?"))
        receiver = _escape(e.get("data", {}).get("receiver", "?"))
        content = _escape(e.get("data", {}).get("content", ""))
        turn = e.get("turn", "?")
        msg_rows += (
            f'<div class="message">'
            f'<span class="turn">[Turn {turn}]</span> '
            f'<strong>{sender}</strong> → <strong>{receiver}</strong>'
            f'<div class="content">{content}</div></div>\n'
        )

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>{_escape(title)}</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 20px}}
.message{{background:#f7f7f7;border-left:3px solid #ccc;margin:8px 0;padding:10px 14px}}
.turn{{color:#888;font-size:.85rem}}.content{{margin-top:6px;white-space:pre-wrap}}
</style></head>
<body><h1>{_escape(title)}</h1>
<p><em>Note: interactive viewer not available — run <code>npm run build</code> in frontend/</em></p>
{msg_rows}
</body></html>"""
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
