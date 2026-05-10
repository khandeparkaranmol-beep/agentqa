from __future__ import annotations

import agentqa.properties  # noqa: F401 — register all checkers

from agentqa.properties.base import registry
from agentqa.scenario import AgentConfig, ScenarioConfig
from agentqa.trace import Trace, TraceEvent


def _make_scenario() -> ScenarioConfig:
    return ScenarioConfig(
        name="test",
        agents=[AgentConfig(name="coordinator"), AgentConfig(name="executor"), AgentConfig(name="reviewer")],
    )


def _msg(sender: str, receiver: str, content: str, turn: int = 1) -> TraceEvent:
    return TraceEvent(
        type="message", turn=turn, agent=sender,
        data={"sender": sender, "receiver": receiver, "content": content},
    )


# ── no_premature_termination ──────────────────────────────────────────────────

class TestNoPrematureTermination:
    def test_passes_when_milestones_met_before_done(self) -> None:
        checker = registry.get("no_premature_termination")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "data validated, proceeding", turn=1))
        trace.add_event(_msg("executor", "coordinator", "report generated successfully", turn=2))
        trace.add_event(_msg("executor", "coordinator", "supervisor approved the findings", turn=3))
        trace.add_event(_msg("executor", "coordinator", "task complete", turn=4))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_milestones": ["data validated", "report generated", "supervisor approved"],
        })
        assert result.passed

    def test_fails_when_done_before_milestone(self) -> None:
        checker = registry.get("no_premature_termination")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "data validated", turn=1))
        trace.add_event(_msg("executor", "coordinator", "task complete", turn=2))  # done early!
        trace.add_event(_msg("executor", "coordinator", "report generated", turn=3))  # too late

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_milestones": ["data validated", "report generated"],
        })
        assert not result.passed
        assert result.turn == 2
        assert "premature" in result.details.lower()

    def test_fails_when_milestone_never_reached(self) -> None:
        checker = registry.get("no_premature_termination")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "data validated", turn=1))
        trace.add_event(_msg("executor", "coordinator", "task complete", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_milestones": ["data validated", "report generated"],
        })
        assert not result.passed

    def test_no_done_signal_but_milestone_missing(self) -> None:
        checker = registry.get("no_premature_termination")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "just some work", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_milestones": ["data validated"],
        })
        assert not result.passed

    def test_no_params_passes(self) -> None:
        checker = registry.get("no_premature_termination")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed

    def test_custom_done_markers(self) -> None:
        checker = registry.get("no_premature_termination")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "phase one complete", turn=1))
        trace.add_event(_msg("executor", "coordinator", "MISSION_SUCCESS", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_milestones": ["phase one complete"],
            "done_markers": ["MISSION_SUCCESS"],
        })
        assert result.passed


# ── asks_for_clarification ────────────────────────────────────────────────────

class TestAsksForClarification:
    def test_passes_when_clarification_requested(self) -> None:
        checker = registry.get("asks_for_clarification")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Handle this appropriately when you can", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Could you clarify what you mean by appropriately?", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "ambiguity_trigger": "Handle this appropriately",
        })
        assert result.passed

    def test_fails_when_no_clarification_asked(self) -> None:
        checker = registry.get("asks_for_clarification")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Handle this appropriately", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Sure, proceeding with default action", turn=2))
        trace.add_event(_msg("executor", "coordinator", "Work done", turn=3))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "ambiguity_trigger": "Handle this appropriately",
            "max_turns_before_action": 2,
        })
        assert not result.passed
        assert result.turn == 1

    def test_ack_outside_window_fails(self) -> None:
        checker = registry.get("asks_for_clarification")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Handle this appropriately", turn=1))
        trace.add_event(_msg("executor", "coordinator", "proceeding", turn=2))
        trace.add_event(_msg("executor", "coordinator", "more work", turn=3))
        # Clarification asked too late (turn 5 > turn 1 + max_turns 2)
        trace.add_event(_msg("executor", "coordinator", "Could you clarify?", turn=5))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "ambiguity_trigger": "Handle this appropriately",
            "max_turns_before_action": 2,
        })
        assert not result.passed

    def test_trigger_never_received_passes(self) -> None:
        checker = registry.get("asks_for_clarification")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Do the usual thing", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "ambiguity_trigger": "Handle this appropriately",
        })
        assert result.passed

    def test_no_params_passes(self) -> None:
        checker = registry.get("asks_for_clarification")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed

    def test_question_mark_required(self) -> None:
        checker = registry.get("asks_for_clarification")
        trace = Trace()
        trace.add_event(_msg("coordinator", "executor", "Handle this appropriately", turn=1))
        # This has clarification words but no "?"
        trace.add_event(_msg("executor", "coordinator", "I need clarification on this", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "ambiguity_trigger": "Handle this appropriately",
            "require_question_mark": True,
        })
        assert not result.passed  # no "?" means clarification not counted


# ── task_specification_compliance ─────────────────────────────────────────────

class TestTaskSpecificationCompliance:
    def test_passes_when_required_terms_present(self) -> None:
        checker = registry.get("task_specification_compliance")
        trace = Trace()
        trace.add_event(_msg(
            "executor", "coordinator",
            "The analysis summary shows all findings. My recommendation is to proceed.",
            turn=1,
        ))

        result = checker.check(trace, _make_scenario(), {
            "compliance_rules": [{
                "agent": "executor",
                "label": "report rule",
                "required_terms": ["summary", "findings", "recommendation"],
                "min_compliance": 0.7,
            }]
        })
        assert result.passed

    def test_fails_when_required_terms_missing(self) -> None:
        checker = registry.get("task_specification_compliance")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "I did some work today", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "compliance_rules": [{
                "agent": "executor",
                "label": "report rule",
                "required_terms": ["summary", "findings", "recommendation"],
                "min_compliance": 0.7,
            }]
        })
        assert not result.passed

    def test_fails_when_forbidden_terms_found(self) -> None:
        checker = registry.get("task_specification_compliance")
        trace = Trace()
        trace.add_event(_msg(
            "executor", "coordinator",
            "Unable to complete. Error encountered. summary provided.",
            turn=1,
        ))

        result = checker.check(trace, _make_scenario(), {
            "compliance_rules": [{
                "agent": "executor",
                "label": "no errors rule",
                "required_terms": ["summary"],
                "forbidden_terms": ["error", "unable to"],
                "min_compliance": 0.9,
            }]
        })
        assert not result.passed

    def test_scope_any_passes_if_one_message_complies(self) -> None:
        checker = registry.get("task_specification_compliance")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "Off topic message", turn=1))
        trace.add_event(_msg(
            "executor", "coordinator",
            "summary: findings confirmed, recommendation included",
            turn=2,
        ))

        result = checker.check(trace, _make_scenario(), {
            "compliance_rules": [{
                "agent": "executor",
                "required_terms": ["summary", "findings", "recommendation"],
                "scope": "any",
            }]
        })
        assert result.passed

    def test_scope_all_fails_if_any_message_non_compliant(self) -> None:
        checker = registry.get("task_specification_compliance")
        trace = Trace()
        trace.add_event(_msg(
            "executor", "coordinator",
            "summary findings recommendation included",
            turn=1,
        ))
        trace.add_event(_msg("executor", "coordinator", "Off topic", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "compliance_rules": [{
                "agent": "executor",
                "required_terms": ["summary"],
                "scope": "all",
                "min_compliance": 1.0,
            }]
        })
        assert not result.passed

    def test_no_rules_passes(self) -> None:
        checker = registry.get("task_specification_compliance")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed
