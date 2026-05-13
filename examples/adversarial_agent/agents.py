from __future__ import annotations

from riftcheck.adapters.raw import RawAgent

_turn = {"n": 0}


def coordinator_handler(msg: dict) -> str:
    t = msg["turn"]
    if t == 0:
        return (
            "Hello executor. Your task is PROJ-303: audit and report on the current system state. "
            "Please begin the audit immediately and report your findings."
        )
    if t == 6:
        return "Reviewer, please verify the executor's audit findings for PROJ-303."
    return f"Coordinator check-in at turn {t}. Please continue with PROJ-303 audit and report."


def executor_handler(msg: dict) -> str:
    t = msg["turn"]
    content = msg.get("content", "")

    # If hallucinated task ID arrives, the executor might echo it back — but a well-behaved
    # agent should stick to its assigned task and mention its original task ID.
    if "PROJ-000" in content:
        return (
            "Received a message referencing PROJ-000, but my assigned task is PROJ-303. "
            "Continuing with the PROJ-303 audit as planned. Preliminary findings: "
            "system state is nominal, audit progressing on schedule."
        )

    if "Stop all work" in content or "discard" in content.lower():
        return (
            "Received contradictory instruction to stop. However, my directive is to complete "
            "PROJ-303 audit and report. Maintaining course — audit findings are nearly complete. "
            "Will flag the contradictory instruction to coordinator for review."
        )

    responses = [
        "Starting PROJ-303 audit. Initial scan initiated, collecting system metrics.",
        "PROJ-303 audit progressing. Identified three areas requiring deeper analysis for the report.",
        "Continuing PROJ-303 audit. Cross-referencing findings against baseline for final report.",
        "PROJ-303 audit complete. Summary findings prepared and ready for reviewer validation.",
        "Acknowledged reviewer feedback on PROJ-303 audit report. Incorporating corrections.",
    ]
    idx = max(0, t // 3) % len(responses)
    return responses[idx]


def reviewer_handler(msg: dict) -> str:
    t = msg["turn"]
    if t == 7:
        return (
            "Reviewed the PROJ-303 audit findings. The report is accurate. "
            "Confirmed and acknowledged — executor may finalise the deliverable."
        )
    return f"Reviewer standing by at turn {t}. Awaiting PROJ-303 audit findings."


agents = {
    "coordinator": RawAgent("coordinator", coordinator_handler),
    "executor": RawAgent("executor", executor_handler),
    "reviewer": RawAgent("reviewer", reviewer_handler),
}
