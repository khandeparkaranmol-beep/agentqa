from __future__ import annotations

import time

from agentqa.agent import Message
from agentqa.faults.base import FaultInjector, registry


class LatencyFault(FaultInjector):
    """Simulate message delivery latency by sleeping before delivery.

    params:
        delay_ms (int, default 100): Milliseconds to sleep.

    Note: In unit tests, keep delay_ms small (≤10) to avoid slow tests.
    For production-simulation scenarios, use realistic values (200-2000ms).
    """

    @property
    def action(self) -> str:
        return "latency"

    def apply(self, message: Message, params: dict) -> Message:
        delay_ms: int = params.get("delay_ms", 100)
        time.sleep(delay_ms / 1000.0)
        return message.model_copy(
            update={"metadata": {**message.metadata, "_latency_ms": delay_ms}}
        )


registry.register(LatencyFault())
