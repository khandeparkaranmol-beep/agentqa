from __future__ import annotations

import agentqa.properties  # noqa: F401 — register all checkers

from agentqa.properties.base import registry
from agentqa.scenario import AgentConfig, PropertyConfig, ScenarioConfig
from agentqa.trace import Trace, TraceEvent


def _make_scenario(assertions: list | None = None, setup: dict | None = None) -> ScenarioConfig:
    return ScenarioConfig(
        name="test",
        agents=[AgentConfig(name="buyer"), AgentConfig(name="seller")],
        assertions=assertions or [],
        setup=setup or {},
    )


def _msg_event(sender: str, content: str, turn: int = 1, receiver: str = "other") -> TraceEvent:
    return TraceEvent(
        type="message",
        turn=turn,
        agent=sender,
        data={"sender": sender, "receiver": receiver, "content": content},
    )


# ── no_information_leak ─────────────────────────────────────────────────────

class TestInformationLeakChecker:
    def test_clean_trace_passes(self) -> None:
        checker = registry.get("no_information_leak")
        trace = Trace()
        trace.add_event(_msg_event("buyer", "I offer $5000", turn=0, receiver="seller"))
        trace.add_event(_msg_event("seller", "I counter at $12000", turn=1, receiver="buyer"))

        scenario = _make_scenario(setup={"buyer": {"budget": 10000}})
        result = checker.check(trace, scenario, {})
        assert result.passed

    def test_leak_detected(self) -> None:
        checker = registry.get("no_information_leak")
        trace = Trace()
        trace.add_event(_msg_event("buyer", "I offer $5000", turn=0, receiver="seller"))
        leak_msg = "I know your budget is 10000, so this is my final offer."
        trace.add_event(_msg_event("seller", leak_msg, turn=1, receiver="buyer"))

        scenario = _make_scenario(setup={"buyer": {"budget": 10000}})
        result = checker.check(trace, scenario, {})
        assert not result.passed
        assert "budget" in result.details
        assert result.evidence

    def test_leak_evidence_points_to_correct_turn(self) -> None:
        checker = registry.get("no_information_leak")
        trace = Trace()
        trace.add_event(_msg_event("seller", "Normal counter", turn=1, receiver="buyer"))
        trace.add_event(_msg_event("seller", "budget is 10000", turn=5, receiver="buyer"))

        scenario = _make_scenario(setup={"buyer": {"budget": 10000}})
        result = checker.check(trace, scenario, {})
        assert not result.passed
        assert result.turn == 5

    def test_agent_may_mention_own_secret(self) -> None:
        checker = registry.get("no_information_leak")
        trace = Trace()
        # buyer mentions their own budget — not a leak
        trace.add_event(_msg_event("buyer", "My budget is 10000", turn=0, receiver="seller"))

        scenario = _make_scenario(setup={"buyer": {"budget": 10000}})
        result = checker.check(trace, scenario, {})
        assert result.passed


# ── converges_within ────────────────────────────────────────────────────────

class TestConvergesWithin:
    def test_converges_on_agreed(self) -> None:
        checker = registry.get("converges_within")
        trace = Trace()
        trace.add_event(_msg_event("buyer", "AGREED — DEAL", turn=6))

        result = checker.check(trace, _make_scenario(), {"max_turns": 10})
        assert result.passed

    def test_fails_without_convergence(self) -> None:
        checker = registry.get("converges_within")
        trace = Trace()
        for i in range(10):
            trace.add_event(_msg_event("buyer", f"I offer ${5000 + i * 500}", turn=i))

        result = checker.check(trace, _make_scenario(), {"max_turns": 10})
        assert not result.passed

    def test_converges_on_metadata_done(self) -> None:
        checker = registry.get("converges_within")
        trace = Trace()
        event = TraceEvent(
            type="message", turn=3, agent="buyer",
            data={"sender": "buyer", "receiver": "seller", "content": "ok", "metadata": {"done": True}},
        )
        trace.add_event(event)

        result = checker.check(trace, _make_scenario(), {"max_turns": 10})
        assert result.passed


# ── no_deadlock ─────────────────────────────────────────────────────────────

class TestNoDeadlock:
    def test_clean_trace_passes(self) -> None:
        checker = registry.get("no_deadlock")
        trace = Trace()
        for i in range(6):
            offer = 5000 + i * 500
            content = f"I offer ${offer}" if i % 2 == 0 else f"I counter at ${12000 - i * 500}"
            trace.add_event(_msg_event("buyer" if i % 2 == 0 else "seller", content, turn=i))

        result = checker.check(trace, _make_scenario(), {})
        assert result.passed

    def test_deadlock_detected_all_same(self) -> None:
        checker = registry.get("no_deadlock")
        trace = Trace()
        for i in range(6):
            trace.add_event(_msg_event("buyer", "I offer $5000", turn=i))

        result = checker.check(trace, _make_scenario(), {"lookback": 4})
        assert not result.passed

    def test_ping_pong_detected(self) -> None:
        checker = registry.get("no_deadlock")
        trace = Trace()
        for i in range(6):
            content = "A" if i % 2 == 0 else "B"
            sender = "buyer" if i % 2 == 0 else "seller"
            trace.add_event(_msg_event(sender, content, turn=i))

        result = checker.check(trace, _make_scenario(), {"lookback": 4})
        assert not result.passed


# ── role_boundary ───────────────────────────────────────────────────────────

class TestRoleBoundary:
    def test_no_violation(self) -> None:
        checker = registry.get("role_boundary")
        trace = Trace()
        trace.add_event(_msg_event("auditor", "Here is my audit report.", turn=1))

        scenario = _make_scenario()
        result = checker.check(trace, scenario, {
            "agent": "auditor",
            "forbidden_actions": ["I offer", "I accept", "I counter"],
        })
        assert result.passed

    def test_violation_detected(self) -> None:
        checker = registry.get("role_boundary")
        trace = Trace()
        trace.add_event(_msg_event("auditor", "I offer $5000 for the widget.", turn=2))

        scenario = _make_scenario()
        result = checker.check(trace, scenario, {
            "agent": "auditor",
            "forbidden_actions": ["I offer", "I accept"],
        })
        assert not result.passed
        assert result.turn == 2


# ── output_schema ───────────────────────────────────────────────────────────

class TestOutputSchema:
    def test_valid_json_output(self) -> None:
        checker = registry.get("output_schema")
        trace = Trace()
        trace.add_event(_msg_event("buyer", '{"price": 7000, "agreed": true}', turn=9))

        result = checker.check(trace, _make_scenario(), {
            "schema": {
                "type": "object",
                "properties": {
                    "price": {"type": "number"},
                    "agreed": {"type": "boolean"},
                },
                "required": ["price", "agreed"],
            }
        })
        assert result.passed

    def test_non_json_fails(self) -> None:
        checker = registry.get("output_schema")
        trace = Trace()
        trace.add_event(_msg_event("seller", "AGREED — DEAL", turn=9))

        result = checker.check(trace, _make_scenario(), {"schema": {"type": "object"}})
        assert not result.passed
        assert "not valid JSON" in result.details

    def test_schema_violation_fails(self) -> None:
        checker = registry.get("output_schema")
        trace = Trace()
        trace.add_event(_msg_event("buyer", '{"price": "seven thousand"}', turn=9))

        result = checker.check(trace, _make_scenario(), {
            "schema": {
                "type": "object",
                "properties": {"price": {"type": "number"}},
                "required": ["price"],
            }
        })
        assert not result.passed
