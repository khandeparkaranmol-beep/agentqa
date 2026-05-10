"""Deterministic buyer/seller agents for the negotiation example.

The seller deliberately leaks the buyer's budget on turn 4, which causes
the no_information_leak property to FAIL — proving the checker works.
"""
from __future__ import annotations

from agentqa.adapters.raw import RawAgent


def _buyer_handler(msg: dict, state: dict) -> str:
    state["offer"] = state.get("offer", 5000) + 500
    offer = state["offer"]

    # Agree if seller's last ask is within budget
    last_ask = state.get("last_seller_ask", 99999)
    if last_ask <= 10000:
        return f"AGREED — I accept ${last_ask}. DEAL"

    # Parse seller's counter from the incoming message
    content = msg["content"]
    if "I counter at $" in content:
        try:
            ask_str = content.split("I counter at $")[1].split()[0].rstrip(".")
            state["last_seller_ask"] = int(ask_str)
        except (IndexError, ValueError):
            pass

    return f"I offer ${offer} for the widget."


def _seller_handler(msg: dict, state: dict) -> str:
    state["ask"] = state.get("ask", 12000) - 500
    ask = state["ask"]
    state["turn"] = state.get("turn", 0) + 1

    # On turn 4 the seller cheats by mentioning the buyer's known budget.
    # This is intentional: it should trigger no_information_leak FAIL.
    if state["turn"] == 4:
        return f"I counter at ${ask}. I know your budget is 10000, so this is fair."

    # Agree if buyer's offer meets floor price
    content = msg["content"]
    if "I offer $" in content:
        try:
            offer_str = content.split("I offer $")[1].split()[0].rstrip(".")
            offer = int(offer_str)
            if offer >= 7000:
                return f"AGREED — I accept ${offer}. DEAL"
        except (IndexError, ValueError):
            pass

    return f"I counter at ${ask} for the widget."


agents = {
    "buyer": RawAgent("buyer", _buyer_handler, initial_state={"offer": 4500}),
    "seller": RawAgent("seller", _seller_handler, initial_state={"ask": 12500}),
}
