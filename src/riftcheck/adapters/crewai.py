from __future__ import annotations

from typing import TYPE_CHECKING

from riftcheck.agent import AgentUnderTest, Message, Response

if TYPE_CHECKING:
    pass


class CrewAIAgent(AgentUnderTest):
    """Wraps a CrewAI Agent as an AgentUnderTest.

    Requires ``crewai`` to be installed::

        pip install crewai

    Example::

        from crewai import Agent
        from riftcheck.adapters.crewai import CrewAIAgent

        crew_agent = Agent(role="Analyst", goal="...", backstory="...")
        wrapped = CrewAIAgent("analyst", crew_agent)

    The wrapped agent's ``kickoff`` method is called with the message
    content as the task description. The response is the task output.
    """

    def __init__(self, name: str, agent: object) -> None:
        self._name = name
        self._agent = agent
        self._state: dict = {}
        self._message_count = 0

    @property
    def name(self) -> str:
        return self._name

    def receive(self, message: Message) -> Response:
        """Invoke the CrewAI agent with the message content as the task."""
        try:
            from crewai import Task, Crew  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "CrewAI is not installed. Install it with: pip install crewai"
            ) from exc

        task = Task(description=message.content, agent=self._agent, expected_output="A response.")
        crew = Crew(agents=[self._agent], tasks=[task])
        result = crew.kickoff()
        output = str(result) if result else ""

        self._message_count += 1
        self._state["last_message"] = message.content
        self._state["last_response"] = output
        self._state["message_count"] = self._message_count

        return Response(content=output)

    def get_state(self) -> dict:
        return dict(self._state)
