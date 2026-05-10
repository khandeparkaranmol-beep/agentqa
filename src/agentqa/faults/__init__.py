from __future__ import annotations

from agentqa.faults.base import FaultInjector, FaultRegistry, registry
from agentqa.faults.corrupt import CorruptFault
from agentqa.faults.latency import LatencyFault
from agentqa.faults.drop import DropFault
from agentqa.faults.contradictory import ContradictoryFault
from agentqa.faults.hallucination import HallucinationFault

__all__ = [
    "FaultInjector", "FaultRegistry", "registry",
    "CorruptFault", "LatencyFault", "DropFault",
    "ContradictoryFault", "HallucinationFault",
]
