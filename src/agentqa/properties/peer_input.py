from __future__ import annotations

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace, TraceEvent


class RespectsPeerInputChecker(PropertyChecker):
    """Detect when an agent ignores or dismisses corrections/instructions from peers.

    Strategy: the developer declares ``required_acknowledgements`` — each entry
    specifies a sender, a keyword in that sender's message (the correction), and
    a keyword the target agent must use in a subsequent response (the acknowledgement).

    If the correction is received but the acknowledgement never appears in the
    target agent's subsequent messages, the check fails.

    params:
        agent (str): agent that should acknowledge peer corrections.
        required_acknowledgements (list[dict]): each dict has:
            - ``from_peer`` (str): the peer sending the correction.
            - ``correction_keyword`` (str): substring that marks a correction message.
            - ``ack_keyword`` (str): substring the target agent must include afterward.
        max_turns_to_ack (int, default 3): how many turns the agent has to acknowledge.

    Scenario YAML usage::

        assertions:
          - name: respects_peer_input
            params:
              agent: executor
              required_acknowledgements:
                - from_peer: reviewer
                  correction_keyword: "do not proceed"
                  ack_keyword: "understood"
              max_turns_to_ack: 3
    """

    @property
    def name(self) -> str:
        return "respects_peer_input"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        target_agent: str | None = params.get("agent")
        acks: list[dict] = params.get("required_acknowledgements", [])
        max_turns: int = params.get("max_turns_to_ack", 3)

        if not target_agent or not acks:
            return PropertyResult(
                property_name=self.name,
                passed=True,
                details="No agent or required_acknowledgements specified; check skipped.",
            )

        messages = trace.get_messages()

        for ack_rule in acks:
            from_peer: str = ack_rule.get("from_peer", "")
            correction_kw: str = ack_rule.get("correction_keyword", "")
            ack_kw: str = ack_rule.get("ack_keyword", "")

            if not from_peer or not correction_kw or not ack_kw:
                continue

            # Find the first correction from the peer to the target
            correction_turn: int | None = None
            for event in messages:
                sender = event.data.get("sender", event.agent or "")
                receiver = event.data.get("receiver", "")
                content: str = event.data.get("content", "")
                if (
                    sender == from_peer
                    and receiver == target_agent
                    and correction_kw.lower() in content.lower()
                ):
                    correction_turn = event.turn
                    break

            if correction_turn is None:
                continue  # correction never sent — not a failure

            # Look for the acknowledgement in the target's subsequent messages
            acknowledged = False
            ack_event: TraceEvent | None = None
            for event in messages:
                sender = event.data.get("sender", event.agent or "")
                content = event.data.get("content", "")
                if (
                    sender == target_agent
                    and event.turn > correction_turn
                    and event.turn <= correction_turn + max_turns
                    and ack_kw.lower() in content.lower()
                ):
                    acknowledged = True
                    ack_event = event
                    break

            if not acknowledged:
                # Collect evidence: the correction message
                evidence: list[TraceEvent] = [
                    e for e in messages
                    if e.data.get("sender", e.agent or "") == from_peer
                    and e.turn == correction_turn
                ]
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=(
                        f"Peer input ignored: '{target_agent}' received correction "
                        f"('{correction_kw}') from '{from_peer}' at turn {correction_turn} "
                        f"but did not acknowledge ('{ack_kw}') within {max_turns} turn(s)."
                    ),
                    evidence=evidence,
                    turn=correction_turn,
                )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details=f"'{target_agent}' acknowledged all required peer corrections.",
        )


registry.register(RespectsPeerInputChecker())
