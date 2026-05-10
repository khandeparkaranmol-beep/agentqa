from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class Message(BaseModel):
    """A message passed between agents in a simulation."""

    sender: str
    receiver: str
    content: str
    turn: int
    metadata: dict = Field(default_factory=dict)
    timestamp: float = 0.0


class Response(BaseModel):
    """An agent's response to a received message."""

    content: str
    metadata: dict = Field(default_factory=dict)


class AgentUnderTest(ABC):
    """Abstract base class for all agents participating in a simulation."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name identifying this agent."""

    @abstractmethod
    def receive(self, message: Message) -> Response:
        """Process an incoming message and return a response."""

    @abstractmethod
    def get_state(self) -> dict:
        """Return a snapshot of the agent's current internal state."""

    def setup(self) -> None:
        """Called once before the simulation starts. Override to initialize state."""

    def teardown(self) -> None:
        """Called once after the simulation ends. Override to clean up."""


class AgentRegistry:
    """A simple name-to-agent mapping."""

    def __init__(self) -> None:
        self._agents: dict[str, AgentUnderTest] = {}

    def register(self, name: str, agent: AgentUnderTest) -> None:
        """Register an agent under a name."""
        self._agents[name] = agent

    def get(self, name: str) -> AgentUnderTest:
        """Retrieve an agent by name, raising KeyError if not found."""
        if name not in self._agents:
            raise KeyError(f"Agent '{name}' not registered. Available: {list(self._agents)}")
        return self._agents[name]

    def all(self) -> dict[str, AgentUnderTest]:
        """Return all registered agents."""
        return dict(self._agents)
