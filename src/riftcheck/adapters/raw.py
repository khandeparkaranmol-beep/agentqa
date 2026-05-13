from __future__ import annotations

import inspect
from typing import Callable

from riftcheck.agent import AgentUnderTest, Message, Response


class RawAgent(AgentUnderTest):
    """Wraps a plain Python callable as an AgentUnderTest.

    The handler receives a dict with 'sender', 'content', and 'turn' keys
    and must return either a str or a dict with a 'content' key.

    If the handler accepts a second 'state' parameter, the current state dict
    is passed and any mutations persist across turns.
    """

    def __init__(
        self,
        name: str,
        handler: Callable,
        initial_state: dict | None = None,
    ) -> None:
        self._name = name
        self._handler = handler
        self._initial_state: dict = dict(initial_state) if initial_state else {}
        self._state: dict = dict(self._initial_state)
        self._accepts_state = self._check_accepts_state(handler)

    @staticmethod
    def _check_accepts_state(handler: Callable) -> bool:
        try:
            sig = inspect.signature(handler)
            params = list(sig.parameters)
            return len(params) >= 2
        except (ValueError, TypeError):
            return False

    @property
    def name(self) -> str:
        return self._name

    def receive(self, message: Message) -> Response:
        """Call the handler with the message dict and return a Response."""
        msg_dict = {"sender": message.sender, "content": message.content, "turn": message.turn}

        if self._accepts_state:
            result = self._handler(msg_dict, self._state)
        else:
            result = self._handler(msg_dict)

        if isinstance(result, str):
            return Response(content=result)
        if isinstance(result, dict):
            content = result.get("content", "")
            metadata = {k: v for k, v in result.items() if k != "content"}
            return Response(content=content, metadata=metadata)
        raise TypeError(
            f"Handler for agent '{self._name}' returned {type(result).__name__}; "
            "expected str or dict with 'content' key."
        )

    def setup(self) -> None:
        """Reset state to initial values before each run."""
        self._state = dict(self._initial_state)

    def get_state(self) -> dict:
        """Return a copy of the current state."""
        return dict(self._state)
