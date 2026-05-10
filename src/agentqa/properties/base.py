from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from agentqa.trace import Trace, TraceEvent


class PropertyResult(BaseModel):
    """The outcome of running one property checker against a trace."""

    property_name: str
    passed: bool
    details: str
    evidence: list[TraceEvent] = Field(default_factory=list)
    turn: int | None = None


class PropertyChecker(ABC):
    """Abstract base class for all property checkers.

    Checkers are stateless: they receive a complete Trace and return a
    PropertyResult. They must not mutate the trace or any shared state.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """The registered name used to reference this checker in scenario YAML."""

    @abstractmethod
    def check(
        self,
        trace: Trace,
        scenario: "ScenarioConfig",  # type: ignore[name-defined]  # noqa: F821
        params: dict,
    ) -> PropertyResult:
        """Run the check against the trace and return a result."""


class PropertyRegistry:
    """Maps property names (from scenario YAML) to checker instances."""

    def __init__(self) -> None:
        self._checkers: dict[str, PropertyChecker] = {}

    def register(self, checker: PropertyChecker) -> None:
        """Register a checker under its name."""
        self._checkers[checker.name] = checker

    def get(self, name: str) -> PropertyChecker:
        """Retrieve a checker by name, raising KeyError if unknown."""
        if name not in self._checkers:
            available = sorted(self._checkers)
            raise KeyError(
                f"Unknown property '{name}'. Available checkers: {available}. "
                "Make sure the checker is imported and registered."
            )
        return self._checkers[name]

    def all(self) -> dict[str, PropertyChecker]:
        """Return all registered checkers."""
        return dict(self._checkers)


# Module-level registry — all checkers self-register here on import.
registry = PropertyRegistry()
