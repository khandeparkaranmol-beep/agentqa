from __future__ import annotations

# Import all checkers so they self-register with the module-level registry.
import agentqa.properties.information_leak  # noqa: F401
import agentqa.properties.convergence  # noqa: F401
import agentqa.properties.deadlock  # noqa: F401
import agentqa.properties.role_boundary  # noqa: F401
import agentqa.properties.output_schema  # noqa: F401
# v0.2 checkers
import agentqa.properties.information_flow  # noqa: F401
import agentqa.properties.state_continuity  # noqa: F401
import agentqa.properties.conversation_reset  # noqa: F401

from agentqa.properties.base import PropertyResult, registry  # noqa: F401

__all__ = ["PropertyResult", "registry"]
