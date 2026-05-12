# AgentQA — Project Rules for Claude Code

## What This Is

AgentQA is a multi-agent interaction testing framework. It lets developers simulate how their AI agents interact under adversarial scenarios before deploying — catching deadlocks, information leaks, cascading failures, and role violations in a test suite instead of in production.

This is a Python library + CLI tool. It is NOT a web app, NOT a SaaS, NOT an observability platform. It runs entirely on the developer's machine.

## Stack

- **Language:** Python 3.10+ (type hints required everywhere)
- **Package format:** PyPI package, installed via `pip install agentqa`
- **Build system:** pyproject.toml (PEP 621), no setup.py
- **Testing:** pytest (we also ship a pytest plugin)
- **Config format:** YAML for scenario files, parsed with PyYAML
- **Trace format:** JSON Lines (.jsonl) — one event per line
- **CLI:** Click library for command-line interface
- **Dependencies:** Minimal. Only PyYAML, Click, and Pydantic (for data models). No LangChain, no LlamaIndex, no heavy frameworks.

## Project Structure

```
src/agentqa/
├── __init__.py           # Version
├── cli.py                # Click CLI: run, view, diff, dashboard, export, replay, init
├── engine.py             # Simulation engine (core runtime)
├── scenario.py           # YAML scenario loader + validation
├── agent.py              # AgentUnderTest base class + Message/Response models
├── trace.py              # Trace recording + JSONL output
├── display.py            # CLI trace / summary printing
├── export.py             # HTML viewer (React bundle + data inject), MAST export, diff, dashboard
├── replay.py             # Replay property checks from JSONL + scenario YAML
├── scaffold.py           # scenario.yaml + agents.py generation for `agentqa init`
├── topology.py           # Topology summary from traces
├── scanner/              # AST scanners for `agentqa init` (CrewAI, LangGraph, AutoGen)
│   ├── detect.py         # Orchestration + framework detection
│   ├── base.py           # ScanResult, FrameworkScanner
│   ├── crewai.py
│   ├── langgraph.py
│   └── autogen.py
├── properties/           # Property checkers (stateless; register in __init__.py)
│   ├── base.py           # PropertyChecker, PropertyRegistry
│   └── …                 # information_leak, convergence, deadlock, role_boundary, etc.
├── adapters/             # Framework-specific AgentUnderTest wrappers
│   ├── raw.py
│   ├── crewai.py
│   ├── langgraph.py      # LangGraphAgent + LangGraphNodeAgent (node fn wrapper)
│   └── autogen.py
├── faults/               # FaultInjector implementations (engine applies between send/receive)
│   ├── corrupt.py, drop.py, latency.py, contradictory.py, hallucination.py
│   └── base.py
├── viewer/               # Prebuilt single-file HTML (from `frontend/` via npm run build)
└── pytest_plugin.py      # pytest integration (scenario discovery)
frontend/                 # Vite + React trace viewer (not installed with pip; dev-only build)
docs/                     # GitHub Pages: landing, user guide, viewer.html demo copy
```

## Coding Conventions

- **Type hints on every function signature.** No exceptions. Use `from __future__ import annotations` at the top of every file.
- **Docstrings on every public class and method.** Google-style docstrings.
- **No `Any` type.** Use `Unknown` and narrow, or define proper types.
- **Pydantic models for all data structures** that cross module boundaries (scenarios, trace events, property results).
- **Abstract base classes** for extension points: `AgentUnderTest`, `PropertyChecker`, `FaultInjector`.
- **No print statements for user output.** Use the `logging` module for debug/info, and structured output functions for CLI display.
- **Imports:** Standard library first, third-party second, local third. Absolute imports only (`from agentqa.engine import ...`, never relative).

## Architectural Rules

- **The adapter contract is sacred.** `AgentUnderTest` has exactly two methods: `receive(message: Message) -> Response` and `get_state() -> dict`. Do not add methods to this interface without explicit discussion.
- **Property checkers are stateless.** They receive a complete `Trace` and return a `PropertyResult`. They do not modify state.
- **The simulation engine owns the event loop.** Agents do not call each other directly. All communication goes through the engine, which records every message to the trace.
- **Scenarios are declarative data, not code.** The YAML scenario file describes WHAT to test. The engine decides HOW to execute it.
- **No LLM calls in the framework itself.** AgentQA orchestrates the developer's agents (which may use LLMs). AgentQA's own code is deterministic. `agentqa init` uses AST scanning (not an LLM) to scaffold tests from existing code. Optional LLM-assisted scenario authoring remains a separate product direction.
- **Fault injection happens at the engine level**, between message send and receive. Faults never modify agent internals — they modify what the agent sees.
- **Multi-run is default.** The engine always runs scenarios N times (default 5) and reports statistics. Never report a single pass/fail.

## Key Data Models

```python
# These are the core types. All defined in their respective modules with Pydantic.

Message:
  sender: str           # agent name
  receiver: str         # agent name or "__broadcast__"
  content: str          # message body
  turn: int             # turn number
  metadata: dict        # arbitrary key-value pairs
  timestamp: float      # simulation time

TraceEvent:
  type: "message" | "state_change" | "fault_injected" | "property_check"
  turn: int
  agent: str | None
  data: dict
  timestamp: float

PropertyResult:
  property_name: str
  passed: bool
  details: str          # human-readable explanation
  evidence: list[TraceEvent]  # the specific events that caused pass/fail
  
ScenarioConfig:
  name: str
  agents: list[AgentConfig]
  turns: int
  inject: list[FaultConfig]
  assertions: list[PropertyConfig]
  runs: int             # default 5
```

## When in Doubt

- Match existing code style in the module you're editing.
- Prefer clarity over cleverness. This is developer-facing infrastructure — readability matters.
- Don't add new dependencies without asking first. We keep the dependency tree minimal.
- Don't refactor unrelated code while implementing a feature. Keep diffs surgical.
- If a design decision isn't obvious, leave a `# TODO(design):` comment and move on.
- When writing error messages, tell the developer what went wrong AND what to do about it. "Scenario file not found: negotiation.yaml. Did you mean scenarios/negotiation.yaml?"

## Testing This Project

- Run tests: `pytest tests/`
- Run a scenario: `agentqa run examples/negotiation/scenario.yaml`
- Run with multiple iterations: `agentqa run examples/negotiation/scenario.yaml --runs 10`
- Install in dev mode: `pip install -e ".[dev]"`
- Rebuild the HTML viewer template after UI changes: `cd frontend && npm ci && npm run build` (outputs to `src/agentqa/viewer/index.html`)
- Integration tests (real LLM, optional): see `tests/integration/README.md`

## Research Context

This project is informed by peer-reviewed research. Property checkers map to the MAST failure taxonomy (NeurIPS 2025, 14 failure modes). Multi-run testing follows MAESTRO methodology (arXiv 2601.00481). See `product/roadmap.md` for the full mapping.
