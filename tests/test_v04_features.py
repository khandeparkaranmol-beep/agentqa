from __future__ import annotations

import json
import tempfile
from pathlib import Path

import riftcheck.properties  # noqa: F401

from riftcheck.scenario import AgentConfig, MilestoneConfig, PropertyConfig, ScenarioConfig
from riftcheck.trace import Trace, TraceEvent
from riftcheck.topology import classify_topology, topology_summary


def _msg(sender: str, receiver: str, content: str, turn: int = 1) -> TraceEvent:
    return TraceEvent(
        type="message", turn=turn, agent=sender,
        data={"sender": sender, "receiver": receiver, "content": content},
    )


# ── Milestone tracking ────────────────────────────────────────────────────────

class TestMilestoneTracking:
    def _run_with_milestones(self, milestones: list[MilestoneConfig]) -> Trace:
        from riftcheck.adapters.raw import RawAgent
        from riftcheck.engine import SimulationEngine

        scenario = ScenarioConfig(
            name="milestone-test",
            agents=[AgentConfig(name="a"), AgentConfig(name="b")],
            turns=4,
            runs=1,
            milestones=milestones,
        )
        t = {"n": 0}

        def a_handler(msg: dict) -> str:
            t["n"] += 1
            if t["n"] == 1:
                return "data validated for the task"
            return "continuing work"

        def b_handler(msg: dict) -> str:
            return "acknowledged"

        engine = SimulationEngine(
            [RawAgent("a", a_handler), RawAgent("b", b_handler)],
            scenario,
        )
        return engine.run_once()

    def test_milestone_hit_recorded(self) -> None:
        trace = self._run_with_milestones([
            MilestoneConfig(name="data_ready", marker="data validated"),
        ])
        ms_events = [
            e for e in trace.events
            if e.type == "property_check" and e.data.get("is_milestone")
        ]
        assert len(ms_events) == 1
        assert ms_events[0].data["passed"] is True
        assert "data_ready" in ms_events[0].data["property_name"]

    def test_missed_milestone_recorded_as_failed(self) -> None:
        trace = self._run_with_milestones([
            MilestoneConfig(name="report_sent", marker="REPORT SENT"),
        ])
        ms_events = [
            e for e in trace.events
            if e.type == "property_check" and e.data.get("is_milestone")
        ]
        assert len(ms_events) == 1
        assert ms_events[0].data["passed"] is False

    def test_agent_scoped_milestone(self) -> None:
        trace = self._run_with_milestones([
            MilestoneConfig(name="a_validates", marker="data validated", agent="a"),
            MilestoneConfig(name="b_validates", marker="data validated", agent="b"),
        ])
        ms_events = {
            e.data["property_name"]: e.data["passed"]
            for e in trace.events
            if e.type == "property_check" and e.data.get("is_milestone")
        }
        assert ms_events["milestone:a_validates"] is True
        assert ms_events["milestone:b_validates"] is False  # b never says "data validated"

    def test_summarize_includes_milestone_stats(self) -> None:
        from riftcheck.adapters.raw import RawAgent
        from riftcheck.engine import SimulationEngine

        scenario = ScenarioConfig(
            name="ms-summary",
            agents=[AgentConfig(name="a"), AgentConfig(name="b")],
            turns=2,
            runs=2,
            milestones=[MilestoneConfig(name="done", marker="all done")],
        )
        engine = SimulationEngine(
            [RawAgent("a", lambda m: "all done"), RawAgent("b", lambda m: "ok")],
            scenario,
        )
        traces = engine.run()
        summary = engine.summarize(traces)
        assert "milestone:done" in summary.milestone_results
        assert summary.milestone_results["milestone:done"].passes == 2


# ── Topology classification ───────────────────────────────────────────────────

class TestTopologyClassification:
    def _trace_from_pairs(self, pairs: list[tuple[str, str]]) -> Trace:
        trace = Trace()
        for i, (s, r) in enumerate(pairs):
            trace.add_event(_msg(s, r, f"msg {i}", turn=i))
        return trace

    def test_star_topology(self) -> None:
        # hub talks to a, b, c; a, b, c talk only back to hub
        pairs = [
            ("hub", "a"), ("hub", "b"), ("hub", "c"),
            ("a", "hub"), ("b", "hub"), ("c", "hub"),
        ]
        assert classify_topology(self._trace_from_pairs(pairs)) == "star"

    def test_chain_topology(self) -> None:
        pairs = [("a", "b"), ("b", "c"), ("c", "d")]
        assert classify_topology(self._trace_from_pairs(pairs)) == "chain"

    def test_mesh_topology(self) -> None:
        # Everyone talks to everyone
        pairs = [
            ("a", "b"), ("a", "c"),
            ("b", "a"), ("b", "c"),
            ("c", "a"), ("c", "b"),
        ]
        assert classify_topology(self._trace_from_pairs(pairs)) == "mesh"

    def test_empty_trace_is_unknown(self) -> None:
        assert classify_topology(Trace()) == "unknown"

    def test_two_agents_is_chain(self) -> None:
        pairs = [("a", "b"), ("b", "a")]
        assert classify_topology(self._trace_from_pairs(pairs)) == "chain"

    def test_topology_summary_has_expected_fields(self) -> None:
        pairs = [("a", "b"), ("b", "c")]
        summary = topology_summary(self._trace_from_pairs(pairs))
        assert "topology" in summary
        assert "agents" in summary
        assert "unique_edges" in summary
        assert "avg_out_degree" in summary
        assert summary["topology"] == "chain"

    def test_summarize_includes_topology(self) -> None:
        from riftcheck.adapters.raw import RawAgent
        from riftcheck.engine import SimulationEngine

        scenario = ScenarioConfig(
            name="topo-test",
            agents=[AgentConfig(name="a"), AgentConfig(name="b")],
            turns=4, runs=1,
        )
        engine = SimulationEngine(
            [RawAgent("a", lambda m: "hi"), RawAgent("b", lambda m: "hello")],
            scenario,
        )
        traces = engine.run()
        summary = engine.summarize(traces)
        assert summary.topology is not None
        assert summary.topology in ("star", "chain", "tree", "mesh", "unknown")


# ── Export ────────────────────────────────────────────────────────────────────

class TestExport:
    def _make_trace(self) -> Trace:
        trace = Trace()
        trace.add_event(_msg("a", "b", "hello world", turn=0))
        trace.add_event(_msg("b", "a", "hi there", turn=1))
        return trace

    def test_mast_export_produces_valid_jsonl(self) -> None:
        from riftcheck.export import export_mast

        trace = self._make_trace()
        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
            path = Path(f.name)
        try:
            export_mast(trace, path)
            lines = path.read_text().strip().splitlines()
            assert len(lines) >= 3  # header + 2 messages
            records = [json.loads(line) for line in lines]
            types = [r["record_type"] for r in records]
            assert "trace_header" in types
            assert "interaction" in types
        finally:
            path.unlink(missing_ok=True)

    def test_mast_export_header_has_topology(self) -> None:
        from riftcheck.export import export_mast

        trace = self._make_trace()
        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
            path = Path(f.name)
        try:
            export_mast(trace, path)
            header = json.loads(path.read_text().splitlines()[0])
            assert "topology" in header
            assert "agent_count" in header
        finally:
            path.unlink(missing_ok=True)

    def test_html_export_produces_valid_html(self) -> None:
        from riftcheck.export import export_html

        trace = self._make_trace()
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
            path = Path(f.name)
        try:
            export_html(trace, path, title="Test Run")
            html = path.read_text()
            assert "<!doctype html>" in html.lower()
            assert "Test Run" in html
            assert "hello world" in html
            assert "hi there" in html
        finally:
            path.unlink(missing_ok=True)

    def test_html_export_includes_property_results(self) -> None:
        from riftcheck.export import export_html
        from riftcheck.properties.base import PropertyResult

        trace = self._make_trace()
        trace.results.append(PropertyResult(
            property_name="no_deadlock", passed=True, details="All good."
        ))
        # Simulate what the engine adds to trace.events for property checks
        trace.add_event(TraceEvent(
            type="property_check", turn=-1, agent=None,
            data={"property_name": "no_deadlock", "passed": True, "details": "All good.", "is_milestone": False},
        ))
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
            path = Path(f.name)
        try:
            export_html(trace, path)
            html = path.read_text()
            assert "no_deadlock" in html
            assert "All good." in html
        finally:
            path.unlink(missing_ok=True)
