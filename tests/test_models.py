from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from agentqa.agent import Message, Response
from agentqa.scenario import AgentConfig, FaultConfig, PropertyConfig, ScenarioConfig, load_scenario
from agentqa.trace import Trace, TraceEvent


def test_message_roundtrip() -> None:
    msg = Message(sender="alice", receiver="bob", content="hello", turn=1, metadata={"k": "v"})
    assert msg.sender == "alice"
    assert msg.metadata["k"] == "v"
    data = json.loads(msg.model_dump_json())
    msg2 = Message.model_validate(data)
    assert msg == msg2


def test_response_defaults() -> None:
    r = Response(content="ok")
    assert r.metadata == {}


def test_trace_event_roundtrip() -> None:
    event = TraceEvent(type="message", turn=3, agent="buyer", data={"content": "hi"})
    data = json.loads(event.model_dump_json())
    event2 = TraceEvent.model_validate(data)
    assert event == event2


def test_trace_filter_methods() -> None:
    trace = Trace()
    trace.add_event(TraceEvent(type="message", turn=1, agent="buyer", data={}))
    trace.add_event(TraceEvent(type="state_change", turn=1, agent="buyer", data={}))
    trace.add_event(TraceEvent(type="message", turn=2, agent="seller", data={}))

    assert len(trace.get_messages()) == 2
    assert len(trace.get_events_for_agent("buyer")) == 2
    assert len(trace.get_events_for_agent("seller")) == 1


def test_trace_jsonl_roundtrip(tmp_path: Path) -> None:
    trace = Trace()
    trace.add_event(TraceEvent(type="message", turn=1, agent="a", data={"content": "x"}))
    trace.add_event(TraceEvent(type="fault_injected", turn=2, agent=None, data={"fault": "drop"}))

    out = tmp_path / "trace.jsonl"
    trace.to_jsonl(out)

    loaded = Trace.from_jsonl(out)
    assert len(loaded.events) == 2
    assert loaded.events[0].type == "message"
    assert loaded.events[1].type == "fault_injected"


def test_scenario_config_basic() -> None:
    sc = ScenarioConfig(
        name="test",
        agents=[AgentConfig(name="buyer"), AgentConfig(name="seller")],
        turns=10,
        runs=3,
    )
    assert sc.name == "test"
    assert len(sc.agents) == 2
    assert sc.runs == 3


def test_scenario_config_defaults() -> None:
    sc = ScenarioConfig(name="minimal", agents=[AgentConfig(name="agent")])
    assert sc.turns == 20
    assert sc.runs == 5
    assert sc.inject == []
    assert sc.assertions == []


def test_scenario_fault_validates_agent_names() -> None:
    with pytest.raises(ValueError, match="not a declared agent"):
        ScenarioConfig(
            name="bad",
            agents=[AgentConfig(name="buyer")],
            inject=[FaultConfig(at_turn=2, action="drop", target="nobody")],
        )


def test_load_scenario_file_not_found(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="Scenario file not found"):
        load_scenario(tmp_path / "missing.yaml")


def test_load_scenario_valid(tmp_path: Path) -> None:
    yaml_content = """
name: "price negotiation"
agents:
  - name: buyer
    role: "Buy cheap"
  - name: seller
    role: "Sell high"
turns: 10
runs: 2
"""
    p = tmp_path / "scenario.yaml"
    p.write_text(yaml_content)
    sc = load_scenario(p)
    assert sc.name == "price negotiation"
    assert len(sc.agents) == 2
    assert sc.turns == 10
