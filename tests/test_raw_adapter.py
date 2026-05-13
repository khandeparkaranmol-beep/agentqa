from __future__ import annotations

from riftcheck.adapters.raw import RawAgent
from riftcheck.agent import Message


def _make_msg(content: str, turn: int = 1, sender: str = "tester") -> Message:
    return Message(sender=sender, receiver="agent", content=content, turn=turn)


def test_echo_agent() -> None:
    agent = RawAgent("echo", lambda msg: f"Echo: {msg['content']}")
    response = agent.receive(_make_msg("hello"))
    assert response.content == "Echo: hello"


def test_agent_returns_dict() -> None:
    agent = RawAgent("responder", lambda msg: {"content": "ok", "done": True})
    response = agent.receive(_make_msg("ping"))
    assert response.content == "ok"
    assert response.metadata["done"] is True


def test_stateful_counter_agent() -> None:
    def counter_handler(msg: dict, state: dict) -> str:
        state["count"] = state.get("count", 0) + 1
        return f"Message #{state['count']}: {msg['content']}"

    agent = RawAgent("counter", counter_handler, initial_state={"count": 0})
    assert agent.get_state()["count"] == 0

    agent.receive(_make_msg("a", turn=1))
    assert agent.get_state()["count"] == 1

    agent.receive(_make_msg("b", turn=2))
    assert agent.get_state()["count"] == 2

    response = agent.receive(_make_msg("c", turn=3))
    assert response.content == "Message #3: c"
    assert agent.get_state()["count"] == 3


def test_state_is_isolated_copy() -> None:
    agent = RawAgent("agent", lambda msg, state: "ok", initial_state={"x": 1})
    state = agent.get_state()
    state["x"] = 999
    assert agent.get_state()["x"] == 1  # mutation of returned copy didn't affect agent


def test_setup_teardown_defaults() -> None:
    agent = RawAgent("agent", lambda msg: "ok")
    agent.setup()    # should not raise
    agent.teardown() # should not raise
