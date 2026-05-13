from __future__ import annotations

from riftcheck.faults.base import FaultInjector, FaultRegistry, registry
from riftcheck.faults.corrupt import CorruptFault
from riftcheck.faults.latency import LatencyFault
from riftcheck.faults.drop import DropFault
from riftcheck.faults.contradictory import ContradictoryFault
from riftcheck.faults.hallucination import HallucinationFault

__all__ = [
    "FaultInjector", "FaultRegistry", "registry",
    "CorruptFault", "LatencyFault", "DropFault",
    "ContradictoryFault", "HallucinationFault",
]
