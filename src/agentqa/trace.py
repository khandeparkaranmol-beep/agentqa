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
