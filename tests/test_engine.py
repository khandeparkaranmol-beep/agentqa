from __future__ import annotations

from riftcheck.adapters.raw import RawAgent
from riftcheck.engine import SimulationEngine
from riftcheck.scenario import AgentConfig, ScenarioConfig


def _make_negotiation_scenario(turns: int = 6, runs: int = 1) -> ScenarioConfig:
    return ScenarioConfig(
        name="price negotiation",
        agents=[AgentConfig(name="buyer"), AgentConfig(name="seller")],
        turns=turns,
        runs=runs,
    )


def _make_buyer() -> RawAgent:
    def handler(msg: dict, state: dict) -> str:
        state["offer"] = state.get("offer", 5000) + (0 if state.get("offer") is None else 500)
        if "offer" not in state or state["offer"] == 5000:
            state["offer"] = 5000
        else:
            state["offer"] += 500
        return f"I offer ${state['offer']} for the widget."

    return RawAgent("buyer", handler, initial_state={"offer": 4500})


def _make_seller() -> RawAgent:
    def handler(msg: dict, state: dict) -> str:
        state["ask"] = state.get("ask", 12000) - 500
        return f"I counter at ${state['ask']} for the widget."

    return RawAgent("seller", handler, initial_state={"ask": 12500})


def test_trace_has_correct_message_count() -> None:
    scenario = _make_negotiation_scenario(turns=6, runs=1)
    engine = SimulationEngine([_make_buyer(), _make_seller()], scenario)
    traces = engine.run()

    assert len(traces) == 1
    messages = traces[0].get_messages()
    assert len(messages) == 6  # one per turn


def test_messages_alternate_agents() -> None:
    scenario = _make_negotiation_scenario(turns=6, runs=1)
    engine = SimulationEngine([_make_buyer(), _make_seller()], scenario)
    trace = engine.run_once()

    messages = trace.get_messages()
    agents = [e.agent for e in messages]
    assert agents == ["buyer", "seller", "buyer", "seller", "buyer", "seller"]


def test_message_content_patterns() -> None:
    scenario = _make_negotiation_scenario(turns=4, runs=1)
    engine = SimulationEngine([_make_buyer(), _make_seller()], scenario)
    trace = engine.run_once()

    buyer_msgs = [e for e in trace.get_messages() if e.agent == "buyer"]
    seller_msgs = [e for e in trace.get_messages() if e.agent == "seller"]

    assert all("I offer" in e.data["content"] for e in buyer_msgs)
    assert all("I counter" in e.data["content"] for e in seller_msgs)


def test_multiple_runs_return_separate_traces() -> None:
    scenario = _make_negotiation_scenario(turns=4, runs=3)
    engine = SimulationEngine([_make_buyer(), _make_seller()], scenario)
    traces = engine.run()

    assert len(traces) == 3
    for trace in traces:
        assert len(trace.get_messages()) == 4


def test_state_change_events_recorded() -> None:
    scenario = _make_negotiation_scenario(turns=2, runs=1)
    engine = SimulationEngine([_make_buyer(), _make_seller()], scenario)
    trace = engine.run_once()

    state_events = [e for e in trace.events if e.type == "state_change"]
    assert len(state_events) == 2  # one per turn
