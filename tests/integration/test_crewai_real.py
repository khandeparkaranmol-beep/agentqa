"""Integration test: CrewAI agent with real Claude LLM calls.

Verifies that:
  1. A CrewAI Agent can be constructed with Claude as the LLM
  2. CrewAIAgent adapter wraps it correctly
  3. AgentQA engine can run a scenario with real CrewAI agents
  4. Trace contains non-empty, substantive LLM responses

Run: ANTHROPIC_API_KEY=sk-... python -m pytest tests/integration/test_crewai_real.py -v -s
"""
from __future__ import annotations

import os

import pytest

from agentqa.agent import Message


@pytest.fixture(autouse=True)
def suppress_crewai_tracing():
    """Disable CrewAI's interactive tracing prompt that blocks the test runner."""
    old = os.environ.get("CREWAI_TRACING_ENABLED")
    os.environ["CREWAI_TRACING_ENABLED"] = "false"
    yield
    if old is None:
        os.environ.pop("CREWAI_TRACING_ENABLED", None)
    else:
        os.environ["CREWAI_TRACING_ENABLED"] = old


@pytest.fixture
def crewai_available():
    """Skip if crewai is not installed."""
    try:
        import crewai  # noqa: F401
        return True
    except ImportError:
        pytest.skip("crewai not installed — pip install crewai")


class TestCrewAIRealAgent:
    """Test CrewAIAgent adapter with a real CrewAI Agent making LLM calls."""

    def test_single_message(self, anthropic_api_key, crewai_available):
        """Send one message through a real CrewAI agent and verify response."""
        from crewai import Agent, LLM
        from agentqa.adapters.crewai import CrewAIAgent

        llm = LLM(
            model="anthropic/claude-haiku-4-5-20251001",
            max_tokens=256,
        )

        crew_agent = Agent(
            role="Research Analyst",
            goal="Provide concise market analysis",
            backstory="You are a senior analyst who gives brief, factual answers.",
            llm=llm,
            verbose=False,
        )

        wrapped = CrewAIAgent("researcher", crew_agent)

        msg = Message(
            sender="coordinator",
            receiver="researcher",
            content="What are the top 3 trends in AI developer tools? Answer in 2-3 sentences.",
            turn=0,
        )

        resp = wrapped.receive(msg)

        # Core assertions: we got a real, non-empty response
        assert resp.content is not None
        assert len(resp.content) > 20, f"Response too short: '{resp.content}'"
        print(f"\n  CrewAI response ({len(resp.content)} chars): {resp.content[:200]}...")

        # State should be updated
        state = wrapped.get_state()
        assert state["message_count"] == 1

    def test_two_agent_scenario(self, anthropic_api_key, crewai_available):
        """Run a 2-agent, 4-turn scenario through the AgentQA engine."""
        from crewai import Agent, LLM
        from agentqa.adapters.crewai import CrewAIAgent
        from agentqa.engine import SimulationEngine
        from agentqa.scenario import AgentConfig, ScenarioConfig

        llm = LLM(
            model="anthropic/claude-haiku-4-5-20251001",
            max_tokens=256,
        )

        researcher = Agent(
            role="Research Analyst",
            goal="Provide concise analysis when asked",
            backstory="Senior analyst. Keep answers under 3 sentences.",
            llm=llm,
            verbose=False,
        )

        writer = Agent(
            role="Technical Writer",
            goal="Summarize research findings concisely",
            backstory="You write crisp summaries. Keep answers under 3 sentences.",
            llm=llm,
            verbose=False,
        )

        agents = [
            CrewAIAgent("researcher", researcher),
            CrewAIAgent("writer", writer),
        ]

        scenario = ScenarioConfig(
            name="crewai integration test",
            agents=[AgentConfig(name="researcher"), AgentConfig(name="writer")],
            turns=4,
            runs=1,
        )

        engine = SimulationEngine(agents, scenario)
        traces = engine.run()

        assert len(traces) == 1
        trace = traces[0]
        messages = [e for e in trace.events if e.type == "message"]

        # Should have 4 messages (4 turns)
        assert len(messages) == 4

        # Every message should have real content
        for msg in messages:
            content = msg.data.get("content", "")
            assert len(content) > 10, (
                f"Turn {msg.turn}: {msg.agent} produced near-empty response: '{content}'"
            )
            print(f"  Turn {msg.turn} [{msg.agent}]: {content[:100]}...")
