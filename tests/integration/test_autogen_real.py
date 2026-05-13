"""Integration test: AutoGen/AG2 agents with real Claude LLM calls.

Verifies that:
  1. An AG2 AssistantAgent can be constructed with Claude as the LLM
  2. AutoGenAgent adapter wraps it correctly
  3. Riftcheck engine can run a scenario with real AutoGen agents
  4. Trace contains non-empty, substantive LLM responses

Run: ANTHROPIC_API_KEY=sk-... python -m pytest tests/integration/test_autogen_real.py -v -s

Requires: pip install "ag2[anthropic]"
"""
from __future__ import annotations

import pytest

from riftcheck.agent import Message


@pytest.fixture
def autogen_available():
    """Skip if ag2/autogen with Anthropic support is not installed."""
    try:
        from autogen import AssistantAgent  # noqa: F401
        # Check that anthropic extra is installed
        try:
            import anthropic  # noqa: F401
        except ImportError:
            pytest.skip("ag2[anthropic] not installed — pip install 'ag2[anthropic]'")
        return True
    except ImportError:
        pytest.skip("autogen/ag2 not installed — pip install 'ag2[anthropic]'")


def _make_autogen_agent(name: str, system_message: str):
    """Create a real AG2 AssistantAgent configured to use Claude."""
    from autogen import AssistantAgent

    llm_config = {
        "model": "claude-haiku-4-5-20251001",
        "api_type": "anthropic",
        "max_tokens": 256,
    }

    return AssistantAgent(
        name=name,
        system_message=system_message,
        llm_config=llm_config,
        human_input_mode="NEVER",
    )


class TestAutoGenRealAgent:
    """Test AutoGenAgent adapter with real AG2 agents making LLM calls."""

    def test_single_message(self, anthropic_api_key, autogen_available):
        """Send one message through a real AutoGen agent and verify response."""
        from riftcheck.adapters.autogen import AutoGenAgent

        ag_agent = _make_autogen_agent(
            "researcher",
            "You are a research analyst. Give brief, factual answers in 1-2 sentences.",
        )
        wrapped = AutoGenAgent("researcher", ag_agent)

        msg = Message(
            sender="coordinator",
            receiver="researcher",
            content="What are the main approaches to multi-agent orchestration?",
            turn=0,
        )

        resp = wrapped.receive(msg)

        assert resp.content is not None
        assert len(resp.content) > 20, f"Response too short: '{resp.content}'"
        print(f"\n  AutoGen response ({len(resp.content)} chars): {resp.content[:200]}...")

        state = wrapped.get_state()
        assert state["message_count"] == 1

    def test_two_agent_scenario(self, anthropic_api_key, autogen_available):
        """Run a 2-agent, 4-turn scenario through the Riftcheck engine."""
        from riftcheck.adapters.autogen import AutoGenAgent
        from riftcheck.engine import SimulationEngine
        from riftcheck.scenario import AgentConfig, ScenarioConfig

        researcher = AutoGenAgent(
            "researcher",
            _make_autogen_agent(
                "researcher",
                "You are a research analyst. Keep answers to 1-2 sentences.",
            ),
        )

        writer = AutoGenAgent(
            "writer",
            _make_autogen_agent(
                "writer",
                "You are a technical writer. Summarize what you receive in 1-2 sentences.",
            ),
        )

        scenario = ScenarioConfig(
            name="autogen integration test",
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
