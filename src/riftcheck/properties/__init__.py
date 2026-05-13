from __future__ import annotations

# Import all checkers so they self-register with the module-level registry.
import riftcheck.properties.information_leak  # noqa: F401
import riftcheck.properties.convergence  # noqa: F401
import riftcheck.properties.deadlock  # noqa: F401
import riftcheck.properties.role_boundary  # noqa: F401
import riftcheck.properties.output_schema  # noqa: F401
# v0.2 checkers
import riftcheck.properties.information_flow  # noqa: F401
import riftcheck.properties.state_continuity  # noqa: F401
import riftcheck.properties.conversation_reset  # noqa: F401
# v0.3 checkers
import riftcheck.properties.reasoning_action  # noqa: F401
import riftcheck.properties.task_adherence  # noqa: F401
import riftcheck.properties.peer_input  # noqa: F401
import riftcheck.properties.step_repetition  # noqa: F401
import riftcheck.properties.communication_quality  # noqa: F401
# v0.4 checkers
import riftcheck.properties.premature_termination  # noqa: F401
import riftcheck.properties.clarification  # noqa: F401
import riftcheck.properties.task_compliance  # noqa: F401

from riftcheck.properties.base import PropertyResult, registry  # noqa: F401

__all__ = ["PropertyResult", "registry"]
