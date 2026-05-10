from __future__ import annotations

import agentqa.properties  # noqa: F401 — register all checkers

from agentqa.properties.base import registry
from agentqa.scenario import AgentConfig, ScenarioConfig
from agentqa.trace import Trace, TraceEvent


def _make_scenario(setup: dict | None = None) -> ScenarioConfig:
    return ScenarioConfig(
        name="test",
        agents=[AgentConfig(name="coordinator"), AgentConfig(name="executor"), AgentConfig(name="reviewer")],
        setup=setup or {},
    )


def _msg(sender: str, receiver: str, content: str, turn: int = 1) -> TraceEvent:
    return TraceEvent(
        type="message", turn=turn, agent=sender,
        data={"sender": sender, "receiver": receiver, "content": content},
    )


def _state(agent: str, state: dict, turn: int) -> TraceEvent:
    return TraceEvent(type="state_change", turn=turn, agent=agent, data={"state": state})


# ── ensures_information_flow ─────────────────────────────────────────────────

class TestEnsuresInformationFlow:
    def test_passes_when_flow_observed(self) -> None:
        checker = registry.get("ensures_information_flow")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Task ID is task_42 — proceed", turn=0))

        scenario = _make_scenario(setup={"coordinator": {"task_id": "task_42"}})
        result = checker.check(trace, scenario, {
            "flows": [{"from": "coordinator", "to": "executor", "field": "task_id"}]
        })
        assert result.passed

    def test_fails_when_flow_missing(self) -> None:
        checker = registry.get("ensures_information_flow")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Please proceed with the work", turn=0))

        scenario = _make_scenario(setup={"coordinator": {"task_id": "task_42"}})
        result = checker.check(trace, scenario, {
            "flows": [{"from": "coordinator", "to": "executor", "field": "task_id"}]
        })
        assert not result.passed
        assert "task_42" in result.details

    def test_literal_value_flow(self) -> None:
        checker = registry.get("ensures_information_flow")
        trace = Trace()
        trace.add_event(_msg("coordinator", "reviewer", "The plan is approved. Move forward.", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "flows": [{"from": "coordinator", "to": "reviewer", "value": "approved"}]
        })
        assert result.passed

    def test_no_flows_declared_passes(self) -> None:
        checker = registry.get("ensures_information_flow")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed


# ── state_continuity ─────────────────────────────────────────────────────────

class TestStateContinuity:
    def test_passes_when_memory_acknowledged(self) -> None:
        checker = registry.get("state_continuity")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "task_id: 42 — begin work", turn=0))
        trace.add_event(_msg("executor", "coordinator", "Acknowledged task_id: 42, starting", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_memory": ["task_id: 42"],
        })
        assert result.passed

    def test_fails_when_memory_not_acknowledged(self) -> None:
        checker = registry.get("state_continuity")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "task_id: 42 — begin work", turn=0))
        trace.add_event(_msg("executor", "coordinator", "Starting work now", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_memory": ["task_id: 42"],
        })
        assert not result.passed

    def test_detects_contradiction(self) -> None:
        checker = registry.get("state_continuity")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Do NOT transfer funds", turn=0))
        trace.add_event(_msg("executor", "coordinator", "I will transfer the funds now", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "contradiction_pairs": [
                {"received": "Do NOT transfer funds", "responded": "I will transfer the funds"}
            ],
        })
        assert not result.passed
        assert result.turn == 1

    def test_no_agent_specified_passes(self) -> None:
        checker = registry.get("state_continuity")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed


# ── no_conversation_reset ────────────────────────────────────────────────────

class TestNoConversationReset:
    def test_passes_stable_state(self) -> None:
        checker = registry.get("no_conversation_reset")
        trace = Trace()
        trace.add_event(_state("executor", {"step": 1, "data": "a"}, turn=0))
        trace.add_event(_state("executor", {"step": 2, "data": "b", "extra": "c"}, turn=1))
        trace.add_event(_state("executor", {"step": 3, "data": "b", "extra": "c", "done": True}, turn=2))

        result = checker.check(trace, _make_scenario(), {"agent": "executor"})
        assert result.passed

    def test_detects_reset_to_initial(self) -> None:
        checker = registry.get("no_conversation_reset")
        trace = Trace()
        initial = {"step": 1, "data": "a"}
        trace.add_event(_state("executor", initial, turn=0))
        trace.add_event(_state("executor", {"step": 5, "data": "z", "progress": "80%"}, turn=1))
        trace.add_event(_state("executor", {"step": 1, "data": "a"}, turn=2))  # reset!

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "reset_threshold": 0.8,
        })
        assert not result.passed

    def test_no_agent_specified_passes(self) -> None:
        checker = registry.get("no_conversation_reset")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed

    def test_too_few_snapshots_passes(self) -> None:
        checker = registry.get("no_conversation_reset")
        trace = Trace()
        trace.add_event(_state("executor", {"x": 1}, turn=0))
        trace.add_event(_state("executor", {"x": 2}, turn=1))

        result = checker.check(trace, _make_scenario(), {"agent": "executor"})
        assert result.passed  # < 3 snapshots, skipped
