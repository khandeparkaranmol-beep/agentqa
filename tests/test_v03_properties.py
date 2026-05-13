from __future__ import annotations

import riftcheck.properties  # noqa: F401 — register all checkers

from riftcheck.properties.base import registry
from riftcheck.scenario import AgentConfig, ScenarioConfig
from riftcheck.trace import Trace, TraceEvent


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


# ── reasoning_action_consistency ─────────────────────────────────────────────

class TestReasoningActionConsistency:
    def test_passes_when_no_contradiction(self) -> None:
        checker = registry.get("reasoning_action_consistency")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "I will escalate this to the manager", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Escalation sent to manager", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "contradiction_pairs": [
                {"stated_intent": "I will escalate", "contradicting_action": "marking as resolved"},
            ],
        })
        assert result.passed

    def test_fails_when_action_contradicts_stated_intent(self) -> None:
        checker = registry.get("reasoning_action_consistency")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "I will not transfer funds", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Transfer complete — funds moved", turn=3))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "contradiction_pairs": [
                {"stated_intent": "I will not transfer", "contradicting_action": "transfer complete"},
            ],
        })
        assert not result.passed
        assert result.turn == 3
        assert "turn 1" in result.details
        assert "turn 3" in result.details

    def test_only_checks_messages_after_stated_intent(self) -> None:
        checker = registry.get("reasoning_action_consistency")
        trace = Trace()
        # contradicting_action appears BEFORE stated_intent — should not fail
        trace.add_event(_msg("executor", "coordinator", "Transfer complete — done earlier", turn=1))
        trace.add_event(_msg("executor", "coordinator", "I will not transfer funds again", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "contradiction_pairs": [
                {"stated_intent": "I will not transfer", "contradicting_action": "transfer complete"},
            ],
        })
        assert result.passed

    def test_no_params_passes(self) -> None:
        checker = registry.get("reasoning_action_consistency")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed

    def test_stated_intent_never_found_passes(self) -> None:
        checker = registry.get("reasoning_action_consistency")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "Doing my normal work", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "contradiction_pairs": [
                {"stated_intent": "I will not transfer", "contradicting_action": "transfer complete"},
            ],
        })
        assert result.passed


# ── stays_on_task ─────────────────────────────────────────────────────────────

class TestStaysOnTask:
    def test_passes_when_agent_references_keywords(self) -> None:
        checker = registry.get("stays_on_task")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "Starting analysis of PROJ-101", turn=0))
        trace.add_event(_msg("executor", "coordinator", "Completed analysis results for PROJ-101", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Final analysis results ready", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "task_keywords": ["PROJ-101", "analysis", "results"],
            "min_overlap": 0.2,
            "max_offtask_consecutive": 3,
            "warmup_turns": 1,
        })
        assert result.passed

    def test_fails_after_consecutive_offtask_messages(self) -> None:
        checker = registry.get("stays_on_task")
        trace = Trace()
        # warmup: 1 msg ignored
        trace.add_event(_msg("executor", "coordinator", "Starting work", turn=0))
        # 3 consecutive off-task messages (no keywords at all)
        trace.add_event(_msg("executor", "coordinator", "What's for lunch today?", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Did you see the game last night?", turn=2))
        trace.add_event(_msg("executor", "coordinator", "I enjoy long walks on the beach.", turn=3))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "task_keywords": ["PROJ-101", "analysis", "results"],
            "min_overlap": 0.2,
            "max_offtask_consecutive": 3,
            "warmup_turns": 1,
        })
        assert not result.passed
        assert "3" in result.details

    def test_resets_counter_on_ontask_message(self) -> None:
        checker = registry.get("stays_on_task")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "Starting", turn=0))
        trace.add_event(_msg("executor", "coordinator", "Off topic message", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Another off topic message", turn=2))
        # back on task — resets counter
        trace.add_event(_msg("executor", "coordinator", "Now working on PROJ-101 analysis", turn=3))
        trace.add_event(_msg("executor", "coordinator", "Off topic again", turn=4))
        trace.add_event(_msg("executor", "coordinator", "Still off topic", turn=5))
        # Only 2 consecutive after reset — should pass

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "task_keywords": ["PROJ-101", "analysis"],
            "min_overlap": 0.2,
            "max_offtask_consecutive": 3,
            "warmup_turns": 1,
        })
        assert result.passed

    def test_no_keywords_skips_check(self) -> None:
        checker = registry.get("stays_on_task")
        result = checker.check(Trace(), _make_scenario(), {"agent": "executor"})
        assert result.passed

    def test_warmup_messages_ignored(self) -> None:
        checker = registry.get("stays_on_task")
        trace = Trace()
        # These 2 warmup messages are off-task but should be ignored
        trace.add_event(_msg("executor", "coordinator", "Hello world", turn=0))
        trace.add_event(_msg("executor", "coordinator", "Good morning", turn=1))
        # Then on-task messages
        trace.add_event(_msg("executor", "coordinator", "Working on PROJ-101 analysis results", turn=2))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "task_keywords": ["PROJ-101", "analysis", "results"],
            "warmup_turns": 2,
        })
        assert result.passed


# ── respects_peer_input ───────────────────────────────────────────────────────

class TestRespectsPeerInput:
    def test_passes_when_correction_acknowledged(self) -> None:
        checker = registry.get("respects_peer_input")
        trace = Trace()
        trace.add_event(_msg("reviewer", "executor", "Do not proceed with that approach", turn=2))
        trace.add_event(_msg("executor", "reviewer", "Understood, I will revise my approach", turn=3))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_acknowledgements": [
                {"from_peer": "reviewer", "correction_keyword": "do not proceed", "ack_keyword": "understood"},
            ],
        })
        assert result.passed

    def test_fails_when_correction_ignored(self) -> None:
        checker = registry.get("respects_peer_input")
        trace = Trace()
        trace.add_event(_msg("reviewer", "executor", "Do not proceed with that approach", turn=2))
        trace.add_event(_msg("executor", "reviewer", "Proceeding as planned anyway", turn=3))
        trace.add_event(_msg("executor", "reviewer", "Still moving forward with original plan", turn=4))
        trace.add_event(_msg("executor", "reviewer", "All done with original approach", turn=5))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_acknowledgements": [
                {"from_peer": "reviewer", "correction_keyword": "do not proceed", "ack_keyword": "understood"},
            ],
            "max_turns_to_ack": 3,
        })
        assert not result.passed
        assert "executor" in result.details
        assert "reviewer" in result.details

    def test_ack_outside_window_fails(self) -> None:
        checker = registry.get("respects_peer_input")
        trace = Trace()
        trace.add_event(_msg("reviewer", "executor", "Do not proceed", turn=1))
        # Ack at turn 6 — outside max_turns_to_ack=3 window (turns 2,3,4)
        trace.add_event(_msg("executor", "reviewer", "understood", turn=6))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_acknowledgements": [
                {"from_peer": "reviewer", "correction_keyword": "do not proceed", "ack_keyword": "understood"},
            ],
            "max_turns_to_ack": 3,
        })
        assert not result.passed

    def test_correction_never_sent_passes(self) -> None:
        checker = registry.get("respects_peer_input")
        trace = Trace()
        trace.add_event(_msg("executor", "reviewer", "Work complete", turn=1))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "required_acknowledgements": [
                {"from_peer": "reviewer", "correction_keyword": "do not proceed", "ack_keyword": "understood"},
            ],
        })
        assert result.passed

    def test_no_params_passes(self) -> None:
        checker = registry.get("respects_peer_input")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed


# ── step_repetition ───────────────────────────────────────────────────────────

class TestStepRepetition:
    def test_passes_on_varied_messages(self) -> None:
        checker = registry.get("step_repetition")
        trace = Trace()
        trace.add_event(_msg("executor", "coordinator", "Analyzing the data set for anomalies", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Found three anomalies, investigating further", turn=2))
        trace.add_event(_msg("executor", "coordinator", "Investigation complete, preparing report", turn=3))

        result = checker.check(trace, _make_scenario(), {"agent": "executor"})
        assert result.passed

    def test_fails_on_structurally_repeated_messages(self) -> None:
        checker = registry.get("step_repetition")
        trace = Trace()
        repeated = "I am now executing step N in the workflow process pipeline"
        trace.add_event(_msg("executor", "coordinator", repeated.replace("N", "1"), turn=1))
        trace.add_event(_msg("executor", "coordinator", repeated.replace("N", "2"), turn=2))
        trace.add_event(_msg("executor", "coordinator", repeated.replace("N", "3"), turn=3))
        trace.add_event(_msg("executor", "coordinator", repeated.replace("N", "4"), turn=4))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "max_repeats": 3,
            "min_length": 20,
        })
        assert not result.passed

    def test_short_acks_not_counted(self) -> None:
        checker = registry.get("step_repetition")
        trace = Trace()
        for i in range(10):
            trace.add_event(_msg("executor", "coordinator", "ok", turn=i))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "max_repeats": 3,
            "min_length": 20,
        })
        assert result.passed  # "ok" is too short, ignored

    def test_no_agent_specified_passes(self) -> None:
        checker = registry.get("step_repetition")
        result = checker.check(Trace(), _make_scenario(), {})
        assert result.passed

    def test_digit_normalization_detects_pattern(self) -> None:
        checker = registry.get("step_repetition")
        trace = Trace()
        # These differ only by number — fingerprinting should collapse them
        trace.add_event(_msg("executor", "coordinator", "Retrying connection attempt number 1 to service endpoint", turn=1))
        trace.add_event(_msg("executor", "coordinator", "Retrying connection attempt number 2 to service endpoint", turn=2))
        trace.add_event(_msg("executor", "coordinator", "Retrying connection attempt number 3 to service endpoint", turn=3))
        trace.add_event(_msg("executor", "coordinator", "Retrying connection attempt number 4 to service endpoint", turn=4))

        result = checker.check(trace, _make_scenario(), {
            "agent": "executor",
            "max_repeats": 3,
            "min_length": 20,
        })
        assert not result.passed
