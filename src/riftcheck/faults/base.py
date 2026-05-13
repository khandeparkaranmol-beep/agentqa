from __future__ import annotations

from abc import ABC, abstractmethod

from riftcheck.agent import Message


class FaultInjector(ABC):
    """Abstract base class for fault injectors.

    Faults intercept a Message on its way to the receiving agent.
    They may modify, delay, or suppress the message entirely.
    They never touch agent internals.
    """

    @property
    @abstractmethod
    def action(self) -> str:
        """The action name used in FaultConfig.action."""

    @abstractmethod
    def apply(self, message: Message, params: dict) -> Message | None:
        """Apply the fault to the message.

        Args:
            message: The outgoing message about to be delivered.
            params: Fault-specific parameters from the scenario YAML.

        Returns:
            The (possibly modified) message, or None to drop it entirely.
        """


class FaultRegistry:
    """Maps fault action names to injector instances."""

    def __init__(self) -> None:
        self._faults: dict[str, FaultInjector] = {}

    def register(self, fault: FaultInjector) -> None:
        self._faults[fault.action] = fault

    def get(self, action: str) -> FaultInjector:
        if action not in self._faults:
            available = sorted(self._faults)
            raise KeyError(
                f"Unknown fault action '{action}'. Available: {available}"
            )
        return self._faults[action]

    def all(self) -> dict[str, FaultInjector]:
        return dict(self._faults)


registry = FaultRegistry()
