"""Three-agent task delegation example: coordinator → executor → reviewer.

Demonstrates ensures_information_flow and state_continuity checkers.
"""
from __future__ import annotations

from agentqa.adapters.raw import RawAgent


def _coordinator_handler(msg: dict, state: dict) -> str:
    state["turn"] = state.get("turn", 0) + 1
    t = state["turn"]

    if t == 1:
        return "Assigning task PROJ-101 (priority: high) to executor. Please begin analysis."
    if t == 2:
        return "Coordinator reviewing executor output. Please summarise findings."
    if t == 3:
        return "AGREED — task PROJ-101 is complete. DEAL"
    return f"Coordinator: awaiting response (turn {t})"


def _executor_handler(msg: dict, state: dict) -> str:
    state["turn"] = state.get("turn", 0) + 1
    content = msg["content"]

    if "PROJ-101" in content:
        state["task_id"] = "PROJ-101"

    t = state["turn"]
    task = state.get("task_id", "unknown task")

    if t == 1:
        return f"Acknowledged {task}. Starting analysis now."
    if t == 2:
        return f"Analysis of {task} complete. Results: all checks passed, no issues found."
    return f"Executor: continuing work on {task} (turn {t})"


def _reviewer_handler(msg: dict, state: dict) -> str:
    state["turn"] = state.get("turn", 0) + 1
    t = state["turn"]
    if t == 1:
        return "Reviewer: monitoring progress."
    if "Results" in msg["content"] or "complete" in msg["content"].lower():
        return "Reviewer: output looks good. Approved."
    return f"Reviewer: still reviewing (turn {t})"


agents = {
    "coordinator": RawAgent("coordinator", _coordinator_handler),
    "executor": RawAgent("executor", _executor_handler),
    "reviewer": RawAgent("reviewer", _reviewer_handler),
}
