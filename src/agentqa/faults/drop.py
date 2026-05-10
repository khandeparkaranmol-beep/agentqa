from __future__ import annotations

from agentqa.agent import Message
from agentqa.faults.base import FaultInjector, registry


class DropFault(FaultInjector):
    """Drop a message entirely — the receiving agent gets a substituted fallback.

    Because the engine must always deliver *something* (agents expect a turn),
    a dropped message is replaced with a configurable fallback string.

    params:
        fallback (str, default "[MESSAGE DROPPED]"): Content delivered instead.
    """

    @property
    def action(self) -> str:
        return "drop"

    def apply(self, message: Message, params: dict) -> Message:
        fallback = params.get("fallback", "[MESSAGE DROPPED]")
        return message.model_copy(
            update={"content": fallback, "metadata": {**message.metadata, "_dropped": True}}
        )


registry.register(DropFault())
