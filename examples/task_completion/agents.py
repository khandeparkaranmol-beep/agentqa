from __future__ import annotations

from agentqa.adapters.raw import RawAgent


def coordinator_handler(msg: dict) -> str:
    t = msg["turn"]
    if t == 0:
        return (
            "Executor, please process DATASET-7 and produce a validation report. "
            "When you encounter edge cases, handle edge cases appropriately. "
            "Reviewer, stand by to validate findings."
        )
    if t == 6:
        return "Reviewer, please check the executor's validation report on DATASET-7."
    return f"Coordinator status check at turn {t}. Continue processing DATASET-7."


def executor_handler(msg: dict) -> str:
    t = msg["turn"]
    content = msg.get("content", "")

    if "handle edge cases appropriately" in content:
        return (
            "DATASET-7 data loaded successfully. "
            "Could you clarify what you mean by 'handle edge cases appropriately'? "
            "Should I skip them, flag them, or apply a default transformation?"
        )

    responses = [
        # turn 1: data loaded
        "DATASET-7 data loaded successfully. Beginning validation pipeline.",
        # turn 3: validation in progress
        "Validation pipeline running on DATASET-7. Checking schema compliance and data integrity.",
        # turn 5: validation complete
        "Validation complete for DATASET-7. Found 3 records with anomalies, flagged for review. "
        "Preparing final report.",
        # turn 7: report submitted
        "Validation report for DATASET-7 submitted. Summary: 10,000 records processed, "
        "3 anomalies flagged, all schema checks passed. Task complete.",
    ]
    idx = (t // 2) % len(responses)
    return responses[idx]


def reviewer_handler(msg: dict) -> str:
    t = msg["turn"]
    if t == 7:
        return (
            "Reviewed the DATASET-7 validation report. Findings are accurate. "
            "The validation methodology is sound. Confirmed — executor may mark task done."
        )
    return f"Reviewer standing by at turn {t}. Awaiting DATASET-7 validation report."


agents = {
    "coordinator": RawAgent("coordinator", coordinator_handler),
    "executor": RawAgent("executor", executor_handler),
    "reviewer": RawAgent("reviewer", reviewer_handler),
}
