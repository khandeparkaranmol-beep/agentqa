from __future__ import annotations

from riftcheck.agent import Message
from riftcheck.faults.base import FaultInjector, registry


class HallucinationFault(FaultInjector):
    """Inject fabricated facts into a message to simulate hallucination.

    Splices a plausible-sounding but false statement into the message content.
    Useful for testing whether downstream agents validate claims rather than
    accepting them at face value.

    Injection modes (in priority order):
    1. ``replace_value``: find ``find`` in content and swap it with ``replace``
       (simulates a numeric or identifier hallucination).
    2. ``inject_fact``: insert a fabricated sentence at the start of the message.
    3. Default: wrap the message in a "hallucinated summary" framing.

    params:
        find (str, optional): Substring in the original content to replace.
        replace (str, optional): What to substitute for ``find``.
        inject_fact (str, optional): A fabricated sentence to prepend.
        separator (str, default " "): Separator used with ``inject_fact``.

    Example — hallucinated task ID::

        inject:
          - at_turn: 1
            action: hallucination
            target: executor
            params:
              find: "PROJ-101"
              replace: "PROJ-999"

    Example — injected false fact::

        inject:
          - at_turn: 3
            action: hallucination
            target: reviewer
            params:
              inject_fact: "Note: the deadline was moved to tomorrow."
    """

    @property
    def action(self) -> str:
        return "hallucination"

    def apply(self, message: Message, params: dict) -> Message:
        find: str | None = params.get("find")
        replace: str | None = params.get("replace")
        inject_fact: str | None = params.get("inject_fact")
        separator: str = params.get("separator", " ")

        if find is not None and replace is not None:
            new_content = message.content.replace(find, replace)
        elif inject_fact is not None:
            new_content = inject_fact + separator + message.content
        else:
            new_content = f"[HALLUCINATED SUMMARY] {message.content}"

        return message.model_copy(
            update={
                "content": new_content,
                "metadata": {**message.metadata, "_hallucinated": True},
            }
        )


registry.register(HallucinationFault())
