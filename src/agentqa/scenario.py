from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field, model_validator


class AgentConfig(BaseModel):
    """Configuration for one agent in a scenario."""

    name: str
    role: str | None = None
    config: dict = Field(default_factory=dict)


class FaultConfig(BaseModel):
    """A fault injection directive."""

    at_turn: int
    action: str
    target: str
    params: dict = Field(default_factory=dict)


class PropertyConfig(BaseModel):
    """An assertion to check against the simulation trace."""

    name: str
    params: dict = Field(default_factory=dict)


class ScenarioConfig(BaseModel):
    """Full configuration for one test scenario, loaded from YAML."""

    name: str
    agents: list[AgentConfig]
    turns: int = 20
    inject: list[FaultConfig] = Field(default_factory=list)
    assertions: list[PropertyConfig] = Field(default_factory=list)
    runs: int = 5
    setup: dict = Field(default_factory=dict)
    agents_file: str | None = None  # relative path to agents.py, resolved from scenario dir

    @model_validator(mode="after")
    def _validate_agent_references(self) -> ScenarioConfig:
        agent_names = {a.name for a in self.agents}
        for fault in self.inject:
            if fault.target not in agent_names:
                raise ValueError(
                    f"Fault target '{fault.target}' is not a declared agent. "
                    f"Declared agents: {sorted(agent_names)}"
                )
        return self


def load_scenario(path: Path) -> ScenarioConfig:
    """Load and validate a YAML scenario file.

    Args:
        path: Path to the .yaml scenario file.

    Returns:
        Validated ScenarioConfig instance.

    Raises:
        FileNotFoundError: When the scenario file does not exist.
        ValueError: When the YAML content fails validation.
    """
    if not path.exists():
        candidates = list(path.parent.glob("*.yaml")) + list(path.parent.glob("*.yml"))
        hint = f" Did you mean one of: {[str(c) for c in candidates]}?" if candidates else ""
        raise FileNotFoundError(
            f"Scenario file not found: {path}.{hint}"
        )

    with path.open() as fh:
        raw = yaml.safe_load(fh)

    if not isinstance(raw, dict):
        raise ValueError(f"Scenario file must be a YAML mapping, got {type(raw).__name__}: {path}")

    return ScenarioConfig.model_validate(raw)
