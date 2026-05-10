from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class TraceEvent(BaseModel):
    """A single recorded event in a simulation trace."""

    type: Literal["message", "state_change", "fault_injected", "property_check"]
    turn: int
    agent: str | None = None
    data: dict = Field(default_factory=dict)
    timestamp: float = 0.0
    # Cost fields — populated by agents that track token usage
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0


class CostSummary(BaseModel):
    """Aggregate token and cost statistics for one trace."""

    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    per_agent: dict[str, dict]  # agent_name -> {input_tokens, output_tokens, cost_usd, turns}


class Trace:
    """An ordered sequence of events recorded during one simulation run."""

    def __init__(self) -> None:
        self._events: list[TraceEvent] = []
        self.results: list = []  # PropertyResult list populated by engine

    def add_event(self, event: TraceEvent) -> None:
        """Append an event to the trace."""
        self._events.append(event)

    @property
    def events(self) -> list[TraceEvent]:
        """All events in insertion order."""
        return list(self._events)

    def get_messages(self) -> list[TraceEvent]:
        """Return only message-type events."""
        return [e for e in self._events if e.type == "message"]

    def get_events_for_agent(self, name: str) -> list[TraceEvent]:
        """Return all events attributed to the named agent."""
        return [e for e in self._events if e.agent == name]

    def cost_summary(self) -> CostSummary:
        """Aggregate token and cost data across all message events."""
        per_agent: dict[str, dict] = {}
        total_input = 0
        total_output = 0
        total_cost = 0.0

        for event in self.get_messages():
            agent = event.agent or "__unknown__"
            if agent not in per_agent:
                per_agent[agent] = {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cost_usd": 0.0,
                    "turns": 0,
                }
            per_agent[agent]["input_tokens"] += event.input_tokens
            per_agent[agent]["output_tokens"] += event.output_tokens
            per_agent[agent]["cost_usd"] += event.cost_usd
            per_agent[agent]["turns"] += 1

            total_input += event.input_tokens
            total_output += event.output_tokens
            total_cost += event.cost_usd

        return CostSummary(
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_cost_usd=total_cost,
            per_agent=per_agent,
        )

    def to_jsonl(self, path: Path) -> None:
        """Write each event as one JSON line to path."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w") as fh:
            for event in self._events:
                fh.write(event.model_dump_json() + "\n")

    @classmethod
    def from_jsonl(cls, path: Path) -> Trace:
        """Read a trace back from a JSONL file."""
        trace = cls()
        with path.open() as fh:
            for line in fh:
                line = line.strip()
                if line:
                    trace.add_event(TraceEvent.model_validate(json.loads(line)))
        return trace
