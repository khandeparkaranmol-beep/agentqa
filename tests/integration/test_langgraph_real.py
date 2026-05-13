"""Integration test: LangGraph node functions with real Claude LLM calls.

Verifies that:
  1. ChatAnthropic can be used inside a LangGraph node function
  2. LangGraphNodeAgent adapter correctly handles LangChain message objects
  3. Riftcheck engine can run a scenario with real LangGraph nodes
  4. Trace contains non-empty, substantive LLM responses

Run: ANTHROPIC_API_KEY=sk-... python -m pytest tests/integration/test_langgraph_real.py -v -s
"""
from __future__ import annotations

import pytest

from riftcheck.agent import Message


@pytest.fixture
def langgraph_available():
    """Skip if langchain-anthropic is not installed."""
    try:
        from langchain_anthropic import ChatAnthropic  # noqa: F401
        return True
    except ImportError:
        pytest.skip("langchain-anthropic not installed — pip install langchain-anthropic langgraph")


def _make_llm_node(role_prompt: str):
    """Create a LangGraph node function that calls Claude via ChatAnthropic.

    Returns a function with signature (state: dict) -> dict that:
      - Reads the 'messages' list from state
      - Calls Claude with the last message as context
      - Appends the response to messages
    """
    def node_fn(state: dict) -> dict:
        from langchain_anthropic import ChatAnthropic
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatAnthropic(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
        )

        messages_in = state.get("messages", [])
        last_msg = messages_in[-1] if messages_in else "Hello"

        # Convert to LangChain messages
        lc_messages = [
            SystemMessage(content=role_prompt),
            HumanMessage(content=str(last_msg)),
        ]

        response = llm.invoke(lc_messages)
        output_text = response.content if hasattr(response, "content") else str(response)

        return {
            "messages": messages_in + [output_text],
            "last_role": role_prompt[:30],
        }

    return node_fn


class TestLangGraphRealAgent:
    """Test LangGraphNodeAgent adapter with real LLM-powered node functions."""

    def test_single_node_call(self, anthropic_api_key, langgraph_available):
        """Call a single LangGraph node that makes a real Claude call."""
        from riftcheck.adapters.langgraph import LangGraphNodeAgent

        researcher = _make_llm_node("You are a research analyst. Give brief, factual answers in 1-2 sentences.")
        wrapped = LangGraphNodeAgent("researcher", researcher)

        msg = Message(
            sender="coordinator",
            receiver="researcher",
            content="What is the current state of AI code generation tools?",
            turn=0,
        )

        resp = wrapped.receive(msg)

        assert resp.content is not None
        assert len(resp.content) > 20, f"Response too short: '{resp.content}'"
        print(f"\n  LangGraph node response ({len(resp.content)} chars): {resp.content[:200]}...")

    def test_two_node_chain(self, anthropic_api_key, langgraph_available):
        """Run a researcher → writer chain with real LLM calls."""
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.engine import SimulationEngine
        from riftcheck.scenario import AgentConfig, ScenarioConfig

        researcher = LangGraphNodeAgent(
            "researcher",
            _make_llm_node("You are a research analyst. Provide 1-2 key facts about the topic you're asked about."),
        )

        writer = LangGraphNodeAgent(
            "writer",
            _make_llm_node("You are a technical writer. Summarize the information you receive in 1-2 clear sentences."),
        )

        scenario = ScenarioConfig(
            name="langgraph integration test",
            agents=[AgentConfig(name="researcher"), AgentConfig(name="writer")],
            turns=4,
            runs=1,
        )

        engine = SimulationEngine([researcher, writer], scenario)
        traces = engine.run()

        assert len(traces) == 1
        trace = traces[0]
        messages = [e for e in trace.events if e.type == "message"]

        assert len(messages) == 4

        for msg in messages:
            content = msg.data.get("content", "")
            assert len(content) > 10, (
                f"Turn {msg.turn}: {msg.agent} produced near-empty response: '{content}'"
            )
            print(f"  Turn {msg.turn} [{msg.agent}]: {content[:100]}...")

    def test_node_state_persists(self, anthropic_api_key, langgraph_available):
        """Verify that node state accumulates across turns."""
        from riftcheck.adapters.langgraph import LangGraphNodeAgent

        node = LangGraphNodeAgent(
            "researcher",
            _make_llm_node("You are a research analyst. Give brief answers."),
        )

        # Send two messages
        for i in range(2):
            msg = Message(sender="engine", receiver="researcher", content=f"Question {i+1}: What is Python?", turn=i)
            node.receive(msg)

        state = node.get_state()
        # State should have accumulated messages from both calls
        messages = state.get("messages", [])
        assert len(messages) >= 2, f"Expected at least 2 messages in state, got {len(messages)}"
