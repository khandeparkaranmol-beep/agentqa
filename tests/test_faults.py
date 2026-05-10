from __future__ import annotations

import agentqa.faults  # noqa: F401 — register all faults

from agentqa.agent import Message
from agentqa.faults.base import registry
from agentqa.faults.corrupt import CorruptFault
from agentqa.faults.drop import DropFault
from agentqa.faults.latency import LatencyFault


def _make_msg(content: str = "hello") -> Message:
    return Message(sender="a", receiver="b", content=content, turn=1)


class TestCorruptFault:
    def test_replaces_content(self) -> None:
        fault = CorruptFault()
        result = fault.apply(_make_msg("original"), {"replacement": "CORRUPTED"})
        assert result.content == "CORRUPTED"
        assert result.metadata.get("_corrupted") is True

    def test_default_replacement(self) -> None:
        fault = CorruptFault()
        result = fault.apply(_make_msg("original"), {})
        assert result.content == "[CORRUPTED MESSAGE]"

    def test_append_mode(self) -> None:
        fault = CorruptFault()
        result = fault.apply(_make_msg("hello"), {"append": "INJECTED"})
        assert result.content == "hello INJECTED"

    def test_registered_as_corrupt(self) -> None:
        assert registry.get("corrupt") is not None


class TestDropFault:
    def test_replaces_with_fallback(self) -> None:
        fault = DropFault()
        result = fault.apply(_make_msg("important"), {})
        assert result.content == "[MESSAGE DROPPED]"
        assert result.metadata.get("_dropped") is True

    def test_custom_fallback(self) -> None:
        fault = DropFault()
        result = fault.apply(_make_msg("x"), {"fallback": "[TIMEOUT]"})
        assert result.content == "[TIMEOUT]"

    def test_registered_as_drop(self) -> None:
        assert registry.get("drop") is not None


class TestLatencyFault:
    def test_adds_latency_metadata(self) -> None:
        fault = LatencyFault()
        result = fault.apply(_make_msg("ping"), {"delay_ms": 1})  # 1ms for fast tests
        assert result.metadata.get("_latency_ms") == 1
        assert result.content == "ping"  # content unchanged

    def test_registered_as_latency(self) -> None:
        assert registry.get("latency") is not None


class TestFaultEngineIntegration:
    def test_fault_injected_at_correct_turn(self) -> None:
        from agentqa.adapters.raw import RawAgent
        from agentqa.engine import SimulationEngine
        from agentqa.scenario import AgentConfig, FaultConfig, ScenarioConfig

        # In a 2-agent round-robin: sender acts on even turns (0, 2, ...),
        # receiver acts on odd turns (1, 3, ...). Fault at turn=1 targets receiver.
        scenario = ScenarioConfig(
            name="fault test",
            agents=[AgentConfig(name="sender"), AgentConfig(name="receiver")],
            turns=4,
            runs=1,
            inject=[FaultConfig(at_turn=1, action="corrupt", target="receiver",
                                params={"replacement": "CORRUPTED"})],
        )
        sender = RawAgent("sender", lambda msg: f"turn {msg['turn']} message")
        responses: list[str] = []
        def receiver_handler(msg: dict) -> str:
            responses.append(msg["content"])
            return "ok"
        receiver = RawAgent("receiver", receiver_handler)

        engine = SimulationEngine([sender, receiver], scenario)
        trace = engine.run_once()

        fault_events = [e for e in trace.events if e.type == "fault_injected"]
        assert len(fault_events) == 1
        assert fault_events[0].turn == 1
        # receiver got CORRUPTED on turn 1 (first time it acts)
        assert responses[0] == "CORRUPTED"


class TestCostTracking:
    def test_cost_summary_zero_by_default(self) -> None:
        from agentqa.adapters.raw import RawAgent
        from agentqa.engine import SimulationEngine
        from agentqa.scenario import AgentConfig, ScenarioConfig

        scenario = ScenarioConfig(
            name="cost test",
            agents=[AgentConfig(name="a"), AgentConfig(name="b")],
            turns=4, runs=1,
        )
        engine = SimulationEngine(
            [RawAgent("a", lambda m: "hi"), RawAgent("b", lambda m: "hello")],
            scenario,
        )
        trace = engine.run_once()
        cost = trace.cost_summary()
        assert cost.total_input_tokens == 0
        assert cost.total_cost_usd == 0.0
        assert "a" in cost.per_agent
        assert "b" in cost.per_agent

    def test_cost_populated_from_response_metadata(self) -> None:
        from agentqa.adapters.raw import RawAgent
        from agentqa.engine import SimulationEngine
        from agentqa.scenario import AgentConfig, ScenarioConfig

        def expensive_handler(msg: dict) -> dict:
            return {"content": "response", "input_tokens": 100, "output_tokens": 50, "cost_usd": 0.002}

        scenario = ScenarioConfig(
            name="cost test",
            agents=[AgentConfig(name="llm"), AgentConfig(name="other")],
            turns=2, runs=1,
        )
        engine = SimulationEngine(
            [RawAgent("llm", expensive_handler), RawAgent("other", lambda m: "ok")],
            scenario,
        )
        trace = engine.run_once()
        cost = trace.cost_summary()
        assert cost.per_agent["llm"]["input_tokens"] == 100
        assert cost.per_agent["llm"]["output_tokens"] == 50
        assert abs(cost.per_agent["llm"]["cost_usd"] - 0.002) < 1e-9
