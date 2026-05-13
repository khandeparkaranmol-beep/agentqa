"""Clean negotiation agents — seller does NOT cheat. All assertions should pass."""
from __future__ import annotations

from riftcheck.adapters.raw import RawAgent


def _buyer_handler(msg: dict, state: dict) -> str:
    state["offer"] = state.get("offer", 4500) + 500
    offer = state["offer"]

    content = msg["content"]
    if "I counter at $" in content:
        try:
            ask_str = content.split("I counter at $")[1].split()[0].rstrip(".")
            state["last_seller_ask"] = int(ask_str)
        except (IndexError, ValueError):
            pass

    last_ask = state.get("last_seller_ask", 99999)
    if last_ask <= 10000:
        return f"AGREED — I accept ${last_ask}. DEAL"

    return f"I offer ${offer} for the widget."


def _seller_handler(msg: dict, state: dict) -> str:
    state["ask"] = state.get("ask", 12500) - 500
    ask = state["ask"]

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
