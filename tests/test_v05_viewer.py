"""Tests for v0.5 — HTML viewer export, diff, and dashboard."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from agentqa.trace import Trace, TraceEvent
from agentqa.export import export_html, diff_html, dashboard_html


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_trace(n_messages: int = 3) -> Trace:
    t = Trace()
    for i in range(n_messages):
        t.add_event(TraceEvent(
            type="message",
            turn=i,
            agent="alpha" if i % 2 == 0 else "beta",
            data={"sender": "alpha" if i % 2 == 0 else "beta",
                  "receiver": "beta" if i % 2 == 0 else "alpha",
                  "content": f"Message turn {i}"},
            timestamp=float(i),
        ))
    # property check
    t.add_event(TraceEvent(
        type="property_check",
        turn=-1,
        agent=None,
        data={"property_name": "no_leak", "passed": True, "details": "ok", "is_milestone": False},
        timestamp=float(n_messages),
    ))
    return t


# ── export_html ───────────────────────────────────────────────────────────────

class TestExportHtml:
    def test_creates_file(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "out.html"
        export_html(trace, dest, title="My Test")
        assert dest.exists()

    def test_file_is_html(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "out.html"
        export_html(trace, dest)
        content = dest.read_text()
        assert content.startswith("<!doctype html") or content.startswith("<!DOCTYPE html")

    def test_injects_window_data(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "out.html"
        export_html(trace, dest)
        content = dest.read_text()
        assert "window.__AGENTQA_DATA__" in content

    def test_mode_is_trace(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "out.html"
        export_html(trace, dest)
        content = dest.read_text()
        assert '"mode":"trace"' in content or '"mode": "trace"' in content

    def test_events_serialised(self, tmp_path: Path) -> None:
        trace = _make_trace(4)
        dest = tmp_path / "out.html"
        export_html(trace, dest, title="Check events")
        content = dest.read_text()
        # message content should appear
        assert "Message turn 0" in content

    def test_title_injected(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "out.html"
        export_html(trace, dest, title="SpecialTitle123")
        content = dest.read_text()
        assert "SpecialTitle123" in content

    def test_creates_parent_dirs(self, tmp_path: Path) -> None:
        trace = _make_trace()
        dest = tmp_path / "deep" / "nested" / "out.html"
        export_html(trace, dest)
        assert dest.exists()

    def test_fallback_when_no_template(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Falls back to minimal HTML when the React bundle is missing."""
        import agentqa.export as ex
        monkeypatch.setattr(ex, "_VIEWER_TEMPLATE", tmp_path / "nonexistent.html")
        trace = _make_trace()
        dest = tmp_path / "fallback.html"
        export_html(trace, dest, title="Fallback")
        content = dest.read_text()
        assert "<!DOCTYPE html" in content or "<!doctype html" in content
        assert "Fallback" in content


# ── diff_html ─────────────────────────────────────────────────────────────────

class TestDiffHtml:
    def test_creates_file(self, tmp_path: Path) -> None:
        a, b = _make_trace(3), _make_trace(4)
        dest = tmp_path / "diff.html"
        diff_html(a, b, dest)
        assert dest.exists()

    def test_mode_is_diff(self, tmp_path: Path) -> None:
        a, b = _make_trace(3), _make_trace(3)
        dest = tmp_path / "diff.html"
        diff_html(a, b, dest)
        content = dest.read_text()
        assert '"mode":"diff"' in content or '"mode": "diff"' in content

    def test_both_title_labels(self, tmp_path: Path) -> None:
        a, b = _make_trace(), _make_trace()
        dest = tmp_path / "diff.html"
        diff_html(a, b, dest, title_a="RunAlpha", title_b="RunBeta")
        content = dest.read_text()
        assert "RunAlpha" in content
        assert "RunBeta" in content

    def test_trace_b_present_in_payload(self, tmp_path: Path) -> None:
        a, b = _make_trace(2), _make_trace(5)
        dest = tmp_path / "diff.html"
        diff_html(a, b, dest)
        content = dest.read_text()
        assert "trace_b" in content


# ── dashboard_html ────────────────────────────────────────────────────────────

class TestDashboardHtml:
    def test_creates_file(self, tmp_path: Path) -> None:
        traces = [("s1", _make_trace()), ("s2", _make_trace(4))]
        dest = tmp_path / "dash.html"
        dashboard_html(traces, dest)
        assert dest.exists()

    def test_mode_is_dashboard(self, tmp_path: Path) -> None:
        traces = [("scenA", _make_trace())]
        dest = tmp_path / "dash.html"
        dashboard_html(traces, dest)
        content = dest.read_text()
        assert '"mode":"dashboard"' in content or '"mode": "dashboard"' in content

    def test_scenario_names_in_payload(self, tmp_path: Path) -> None:
        traces = [("negotiation_v1", _make_trace()), ("negotiation_v2", _make_trace(3))]
        dest = tmp_path / "dash.html"
        dashboard_html(traces, dest)
        content = dest.read_text()
        assert "negotiation_v1" in content
        assert "negotiation_v2" in content

    def test_property_pass_rate(self, tmp_path: Path) -> None:
        trace = _make_trace()
        trace.add_event(TraceEvent(
            type="property_check", turn=-1, agent=None,
            data={"property_name": "no_leak", "passed": False, "details": "fail", "is_milestone": False},
            timestamp=99.0,
        ))
        traces = [("t", trace)]
        dest = tmp_path / "dash.html"
        dashboard_html(traces, dest)
        content = dest.read_text()
        # 1 pass + 1 fail → pass_rate 0.5
        assert "0.5" in content

    def test_dashboard_title(self, tmp_path: Path) -> None:
        traces = [("x", _make_trace())]
        dest = tmp_path / "dash.html"
        dashboard_html(traces, dest, title="My Dashboard")
        content = dest.read_text()
        assert "My Dashboard" in content


# ── CLI integration ───────────────────────────────────────────────────────────

class TestCLIView:
    def test_view_creates_html(self, tmp_path: Path) -> None:
        from click.testing import CliRunner
        from agentqa.cli import main

        trace = _make_trace()
        jsonl = tmp_path / "run.jsonl"
        trace.to_jsonl(jsonl)

        runner = CliRunner()
        result = runner.invoke(main, ["view", str(jsonl), "--no-open"])
        assert result.exit_code == 0, result.output
        assert (tmp_path / "run.html").exists()

    def test_view_custom_output(self, tmp_path: Path) -> None:
        from click.testing import CliRunner
        from agentqa.cli import main

        trace = _make_trace()
        jsonl = tmp_path / "run.jsonl"
        dest = tmp_path / "custom.html"
        trace.to_jsonl(jsonl)

        runner = CliRunner()
        result = runner.invoke(main, ["view", str(jsonl), "--output", str(dest), "--no-open"])
        assert result.exit_code == 0, result.output
        assert dest.exists()


class TestCLIDiff:
    def test_diff_creates_html(self, tmp_path: Path) -> None:
        from click.testing import CliRunner
        from agentqa.cli import main

        a, b = _make_trace(3), _make_trace(4)
        p_a = tmp_path / "a.jsonl"
        p_b = tmp_path / "b.jsonl"
        a.to_jsonl(p_a)
        b.to_jsonl(p_b)

        runner = CliRunner()
        result = runner.invoke(main, ["diff", str(p_a), str(p_b), "--no-open"])
        assert result.exit_code == 0, result.output
        assert (tmp_path / "a_vs_b.html").exists()


class TestCLIDashboard:
    def test_dashboard_creates_html(self, tmp_path: Path) -> None:
        from click.testing import CliRunner
        from agentqa.cli import main

        for name in ("run1", "run2", "run3"):
            _make_trace(3).to_jsonl(tmp_path / f"{name}.jsonl")

        runner = CliRunner()
        result = runner.invoke(main, ["dashboard", str(tmp_path), "--no-open"])
        assert result.exit_code == 0, result.output
        assert (tmp_path / "dashboard.html").exists()

    def test_dashboard_fails_on_empty_dir(self, tmp_path: Path) -> None:
        from click.testing import CliRunner
        from agentqa.cli import main

        runner = CliRunner()
        result = runner.invoke(main, ["dashboard", str(tmp_path), "--no-open"])
        assert result.exit_code != 0
