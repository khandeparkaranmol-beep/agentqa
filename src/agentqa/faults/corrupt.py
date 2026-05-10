from __future__ import annotations

from agentqa.agent import Message
from agentqa.faults.base import FaultInjector, registry


class CorruptFault(FaultInjector):
    """Corrupt a message by replacing its content with a garbled version.

    params:
        replacement (str, optional): The corrupted content to substitute.
            Defaults to "[CORRUPTED MESSAGE]".
        append (str, optional): String to append to the original content
            instead of replacing it entirely.
    """

    @property
    def action(self) -> str:
        return "corrupt"

    def apply(self, message: Message, params: dict) -> Message:
        if "append" in params:
            new_content = message.content + " " + params["append"]
        else:
            new_content = params.get("replacement", "[CORRUPTED MESSAGE]")

        return message.model_copy(
            update={"content": new_content, "metadata": {**message.metadata, "_corrupted": True}}
        )


registry.register(CorruptFault())
