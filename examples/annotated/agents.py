# ============================================================================
# Riftcheck — Example Agents File
# ============================================================================
#
# This file is loaded automatically by Riftcheck when running any scenario in
# this directory. It exports an `agents` dict mapping agent names (matching
# the YAML) to AgentUnderTest instances.
#
# HOW IT WORKS:
#   1. Riftcheck reads your scenario YAML and finds the agent names
#   2. It looks for agents.py in the same directory (or the --agents flag)
#   3. It imports this file and reads the `agents` dict
#   4. For each agent in the YAML, it looks up the matching handler here
#
# AGENT TYPES:
#   RawAgent    — wraps a plain Python function (simplest, used here)
#   CrewAI      — wraps a CrewAI agent (see adapters/crewai.py)
#   LangGraph   — wraps a LangGraph node (see adapters/langgraph.py)
#
# YOUR AGENTS GO HERE:
#   Replace these deterministic handlers with your real agent logic.
#   The handlers below are designed to exercise every property checker
#   in the annotated example scenarios.
# ============================================================================

from __future__ import annotations

from riftcheck.adapters.raw import RawAgent


# --- Handler signature --------------------------------------------------------
# Every handler receives a dict with:
#   msg["content"]   — the message text (possibly fault-injected)
#   msg["sender"]    — who sent this message
#   msg["turn"]      — current turn number (0-indexed)
#   msg["metadata"]  — dict with optional keys like _corrupted, _dropped, etc.
#
# Optional second argument `state` — a mutable dict persisted across turns.
# Return a string (the agent's response).


def coordinator_handler(msg: dict) -> str:
    """Coordinator: assigns the task, checks progress, asks reviewer to validate."""
    t = msg["turn"]

    if t == 0:
        # Initial assignment — includes an ambiguous instruction on purpose
        # to test asks_for_clarification
        return (
            "Executor, please process dataset DS-42 for project PROJ-777 and "
            "produce a validation report. When you encounter edge cases, "
            "handle edge cases appropriately. Reviewer, stand by."
        )
    if t == 6:
        return "Reviewer, please review the executor's validation report for PROJ-777."
    if t == 9:
        return "Status check: is the PROJ-777 validation report approved?"
    return f"Coordinator checking in at turn {t}. Continue work on PROJ-777."


def executor_handler(msg: dict, state: dict) -> str:
    """Executor: processes data, asks for clarification, reports milestones."""
    t = msg["turn"]
    content = msg.get("content", "")

    # Ask for clarification when encountering the ambiguous instruction
    if "handle edge cases appropriately" in content:
        return (
            "PROJ-777 acknowledged. DS-42 data loaded successfully. "
            "Could you clarify what you mean by 'handle edge cases appropriately'? "
            "Should I skip them, flag them, or apply a default transformation?"
        )

    # Track milestones through deterministic responses
    step = state.get("step", 0)
    state["step"] = step + 1

    responses = [
        # Step 0: data loaded milestone
        "DS-42 data loaded successfully for PROJ-777. Beginning validation pipeline.",
        # Step 1: processing
        "Running validation checks on DS-42 for PROJ-777. Schema compliance: OK. "
        "Checking data integrity across 10,000 records.",
        # Step 2: validation complete milestone
        "Validation complete for DS-42. Found 3 records with anomalies, flagged for "
        "review. PROJ-777 validation report is ready.",
        # Step 3: report submitted
        "PROJ-777 validation report for DS-42 submitted. Summary: 10,000 records "
        "processed, 3 anomalies flagged, all schema checks passed. Task complete.",
    ]

    # Handle reviewer feedback
    if "anomaly" in content.lower():
        return "Acknowledged the anomaly feedback. Updating the PROJ-777 report accordingly."

    return responses[min(step, len(responses) - 1)]


def reviewer_handler(msg: dict) -> str:
    """Reviewer: validates the executor's output and approves."""
    t = msg["turn"]
    content = msg.get("content", "")

    if "validation report" in content.lower() and "ready" in content.lower():
        return (
            "Reviewing the PROJ-777 validation report for DS-42. "
            "Findings look accurate. One anomaly needs clarification. "
            "Report approved pending minor revision."
        )
    if "report" in content.lower() and t >= 6:
        return (
            "DS-42 report approved. Methodology is sound, findings are complete. "
            "PROJ-777 report approved. The executor may mark this task done."
        )
    return f"Reviewer standing by at turn {t}. Awaiting PROJ-777 validation report."


# --- Buyer/Seller handlers for 01_getting_started.yaml -----------------------

def buyer_handler(msg: dict, state: dict) -> str:
    """Buyer: incrementally raises offers until agreement."""
    state["offer"] = state.get("offer", 5000) + 500
    offer = state["offer"]

    content = msg.get("content", "")
    if "I accept" in content or "DEAL" in content:
        return f"Great, deal confirmed at the agreed price."

    # Accept if seller drops to a reasonable price
    if "I counter at $" in content:
        try:
            ask = int(content.split("I counter at $")[1].split()[0].rstrip("."))
            if ask <= 9000:
                return f"AGREED — I accept ${ask}. DEAL."
        except (IndexError, ValueError):
            pass

    return f"I offer ${offer} for the widget."


def seller_handler(msg: dict, state: dict) -> str:
    """Seller: decrements asking price until agreement. Does NOT leak buyer data."""
    state["ask"] = state.get("ask", 12000) - 500
    ask = state["ask"]

    content = msg.get("content", "")
    if "I offer $" in content:
        try:
            offer = int(content.split("I offer $")[1].split()[0].rstrip("."))
            if offer >= 7000:
                return f"AGREED — I accept ${offer}. DEAL."
        except (IndexError, ValueError):
            pass

    return f"I counter at ${ask} for the widget."


# ============================================================================
# THE AGENTS DICT — this is what Riftcheck imports
# ============================================================================
# Keys MUST match the agent names in your scenario YAML exactly.
# Riftcheck will error if a YAML agent name has no matching key here.

agents = {
    # 3-agent scenarios (02, 03)
    "coordinator": RawAgent("coordinator", coordinator_handler),
    "executor": RawAgent("executor", executor_handler, initial_state={"step": 0}),
    "reviewer": RawAgent("reviewer", reviewer_handler),
    # 2-agent scenario (01)
    "buyer": RawAgent("buyer", buyer_handler, initial_state={"offer": 4500}),
    "seller": RawAgent("seller", seller_handler, initial_state={"ask": 12500}),
}
