"""Base types and abstract scanner class for framework detection."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AgentInfo:
    """Metadata about a discovered agent definition."""

    name: str
    """Agent name (variable name or explicit ``name=`` argument)."""

    role: str = ""
    """The agent's role or goal, extracted from constructor kwargs."""

    framework: str = ""
    """Framework that defined this agent (e.g. 'crewai', 'langgraph')."""

    source_file: str = ""
    """Path to the Python file where this agent was found."""

    variable_name: str = ""
    """The Python variable name the agent is assigned to."""

    extra: dict = field(default_factory=dict)
    """Framework-specific extra fields (goal, backstory, system_message, etc.)."""


@dataclass
class EdgeInfo:
    """A directed communication edge between two agents."""

    source: str
    target: str


@dataclass
class ScanResult:
    """Everything a framework scanner discovered in a project."""

    framework: str
    """Detected framework name (e.g. 'crewai', 'langgraph', 'autogen')."""

    agents: list[AgentInfo]
    """All discovered agent definitions."""

    edges: list[EdgeInfo] = field(default_factory=list)
    """Communication topology edges, if discoverable (e.g. LangGraph)."""

    entry_file: str = ""
    """The primary file containing the crew/graph/group definition."""

    raw_imports: list[str] = field(default_factory=list)
    """Framework import lines found, for reference."""


class FrameworkScanner(ABC):
    """Abstract base class for framework-specific code scanners."""

    @property
    @abstractmethod
    def framework_name(self) -> str:
        """Short identifier: 'crewai', 'langgraph', 'autogen'."""

    @abstractmethod
    def can_scan(self, python_files: list[Path]) -> bool:
        """Return True if this scanner's framework is detected in the files."""

    @abstractmethod
    def scan(self, python_files: list[Path]) -> ScanResult:
        """Parse the files and extract agent definitions + topology."""
