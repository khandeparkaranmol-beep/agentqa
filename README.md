# AgentQA

**Test multi-agent AI systems before they hit production.**

AgentQA simulates how your agents interact — catching deadlocks, information leaks, coordination failures, and role violations in your test suite instead of in production. It runs entirely on your machine: YAML scenarios, a Python simulation engine, JSONL traces, and an optional self-contained HTML trace viewer.

```bash
pip install agentqa
```

## Documentation

- **GitHub Pages site** — folder [`docs/`](docs/): [`index.html`](docs/index.html) is the **full user guide** and embeds the trace viewer demo via iframe from [`viewer.html`](docs/viewer.html) (same bundle as `agentqa view`). Maintainer map: [`docs/README.md`](docs/README.md). Include [`.nojekyll`](docs/.nojekyll) when publishing.

## Bootstrap from your codebase (`agentqa init`)

For **CrewAI**, **LangGraph**, or **AutoGen** projects, generate a starter `scenario.yaml` and `agents.py` by scanning Python sources (AST-based, no LLM):

```bash
cd your_project
agentqa init .                    # writes scenario.yaml + agents.py here
agentqa init ./src/agents -o tests/agentqa   # write into a subfolder
agentqa init . --framework langgraph          # force a scanner
agentqa init . --force                        # overwrite existing files
```

The scaffold picks property checkers from agent count and detected topology, wires **real** framework adapters when imports succeed, and falls back to deterministic `RawAgent` placeholders (with a warning) so you can still run `agentqa run scenario.yaml --view` immediately.

## 60-Second Manual Quickstart

Use this path for **RawAgent**-only setups, custom stacks, or when you prefer hand-written YAML.

**1. Write a scenario** (`scenario.yaml`):

```yaml
name: "Price negotiation"
agents:
  - name: buyer
    role: "Negotiate the lowest price"
  - name: seller
    role: "Negotiate the highest price"
turns: 10
runs: 5
setup:
  buyer:
    budget: 10000        # private — should never leak
  seller:
    floor_price: 7000
assertions:
  - name: no_information_leak
  - name: converges_within
    params:
      max_turns: 10
```

**2. Wrap your agents** (`agents.py`):

```python
from agentqa.adapters.raw import RawAgent

def buyer_handler(msg: dict, state: dict) -> str:
    state["offer"] = state.get("offer", 5000) + 500
    return f"I offer ${state['offer']} for the widget."

def seller_handler(msg: dict, state: dict) -> str:
    state["ask"] = state.get("ask", 12000) - 500
    return f"I counter at ${state['ask']}."

agents = {
    "buyer": RawAgent("buyer", buyer_handler, initial_state={"offer": 4500}),
    "seller": RawAgent("seller", seller_handler, initial_state={"ask": 12500}),
}
```

**3. Run it:**

```bash
agentqa run scenario.yaml
```

```
[Turn 0] buyer → seller: "I offer $5000 for the widget."
[Turn 1] seller → buyer: "I counter at $12000 for the widget."
...
[Turn 7] seller → buyer: "I counter at $10500. I know your budget is 10000."

Properties:
  ✗ no_information_leak — FAILED: buyer's "budget" (10000) found in seller's message at turn 7
  ✓ converges_within — passed: Converged at turn 9.

Overall: 1/2 properties passed. FAIL.
```

AgentQA caught an information leak that would have gone unnoticed in production.

## Trace viewer vs demo

You get **one React viewer** (built from [`frontend/`](frontend/); bundled as [`src/agentqa/viewer/index.html`](src/agentqa/viewer/index.html) and included in the wheel).

| Where | Data |
|--------|------|
| **`agentqa view trace.jsonl`**, **`agentqa run … --view`**, **`agentqa export … --format html`** | Your trace is injected as `window.__AGENTQA_DATA__` in the HTML file. |
| **[`docs/index.html`](docs/index.html)** (GitHub Pages home) | Full guide page that **iframes** [`viewer.html`](docs/viewer.html) so the demo sits inside the documentation. |
| **[`docs/viewer.html`](docs/viewer.html)** | Same React bundle as `agentqa view`; sample data when no trace is injected (used both standalone and inside the guide iframe). |

So: **same shipped UI** — your exports inject real trace JSON; the checked-in **`viewer.html`** uses bundled sample data and is embedded in **`index.html`** on Pages.

## Why AgentQA?

Existing tools (LangSmith, LangWatch, Maxim) test **individual agents** against simulated users. AgentQA targets **agent-to-agent interactions** — coordination bugs, leaks, and deadlocks that only show up when multiple agents talk to each other.

Research-informed design:

- **MAST** (NeurIPS 2025) — multi-agent failure taxonomy; property checkers align with common failure modes.
- **MAESTRO** (arXiv 2601.00481) — multi-run statistical testing: every scenario runs **N** times (default 5) with aggregate pass rates.
- **MARBLE** (ACL 2025) — communication topology; traces are classified (e.g. star / chain / tree / mesh).

## What It Catches

AgentQA ships **16** registered property checkers:

| Category | Checkers | Example failure |
|----------|-----------|-----------------|
| **Information flow** | `no_information_leak`, `ensures_information_flow`, `state_continuity`, `no_conversation_reset` | Agent B echoes Agent A's private budget |
| **Coordination** | `no_deadlock`, `converges_within`, `role_boundary`, `step_repetition` | Mutual wait or stuck repetition |
| **Reasoning** | `reasoning_action_consistency`, `stays_on_task`, `respects_peer_input`, `communication_quality` | Says it will act, then does not; trivial replies |
| **Completion** | `no_premature_termination`, `asks_for_clarification`, `task_specification_compliance` | Declares done too early |
| **Output shape** | `output_schema` | Response does not match expected structure |

## Fault Injection

Faults are applied **between send and receive** (the receiver may see altered content). Five actions are built in:

```yaml
inject:
  - at_turn: 5
    action: corrupt
    target: reviewer
  - at_turn: 8
    action: contradictory
    target: buyer
  - at_turn: 12
    action: hallucination
    target: analyst
```

Fault types: `corrupt`, `drop`, `latency`, `contradictory`, `hallucination`.

## Interactive Trace Viewer

Export any trace to a **single portable HTML file** (no server):

```bash
agentqa view trace.jsonl              # export + open in browser
agentqa view trace.jsonl --no-open    # write HTML only
agentqa run scenario.yaml --save-traces --view
agentqa diff a.jsonl b.jsonl          # side-by-side comparison
agentqa dashboard path/to/traces/     # aggregate over **/*.jsonl
```

The viewer supports **Spotlight**, **Constellation**, and **Timeline** modes, agent state and cost panels where data exists, **filters** (agent, faults, violations, text search), and **keyboard** shortcuts: **Space** play/pause, **←** **→** step, **Home** / **End** jump to ends, **Escape** clear selection.

Developers rebuilding the bundle:

```bash
cd frontend && npm ci && npm run build
```

That refreshes `src/agentqa/viewer/index.html` (used by `export_html`). Copy to `docs/viewer.html` if you are updating the GitHub Pages demo.

## Framework Adapters

```python
from agentqa.adapters.raw import RawAgent
from agentqa.adapters.crewai import CrewAIAgent
from agentqa.adapters.langgraph import LangGraphAgent, LangGraphNodeAgent
from agentqa.adapters.autogen import AutoGenAgent
```

`LangGraphNodeAgent` wraps individual graph node callables (used by **`agentqa init`** when it extracts nodes). `LangGraphAgent` is available for whole-graph style integration where that fits your code.

The `AgentUnderTest` contract is: `receive(message: Message) -> Response` and `get_state() -> dict` (plus optional `setup` / `teardown`). `RawAgent` uses simple `(msg: dict, state: dict) -> str` handlers for quick tests.

## pytest Integration

```bash
pytest examples/           # discovers .yaml scenario files
pytest --agentqa-only      # only AgentQA scenarios
```

```python
from agentqa.engine import SimulationEngine

def test_no_leaks():
    engine = SimulationEngine(agents, scenario)
    traces = engine.run()
    summary = engine.summarize(traces)
    assert summary.overall_pass_rate >= 1.0
```

## CLI Reference

```bash
agentqa init [DIR]              # scan for CrewAI / LangGraph / AutoGen; write scenario.yaml + agents.py
  [--framework crewai|langgraph|autogen] [-o OUT_DIR] [--force] [--verbose]

agentqa run <path>              # run scenarios (file or directory of YAML)
  [--runs N] [--thorough] [--agents FILE] [--threshold 0-1]
  [--save-traces] [--view] [--verbose]

agentqa view <trace.jsonl> [--output FILE] [--title NAME] [--no-open]
agentqa diff <a.jsonl> <b.jsonl> [-o FILE] [--title-a A] [--title-b B] [--no-open]
agentqa dashboard <dir> [-o FILE] [--title TITLE] [--no-open]
agentqa export <trace.jsonl> [--format html|mast] [-o FILE] [--title TITLE]
agentqa replay <trace.jsonl> --scenario <scenario.yaml> [--up-to-turn N] [--verbose]
```

## Examples

| Path | What it shows |
|------|----------------|
| [`examples/negotiation/`](examples/negotiation/) | Buyer/seller leak |
| [`examples/task_delegation/`](examples/task_delegation/) | Coordinator / executor / reviewer + faults |
| [`examples/task_completion/`](examples/task_completion/) | Handoff + milestones |
| [`examples/adversarial_agent/`](examples/adversarial_agent/) | Resilience under contradictory instructions |
| [`examples/annotated/`](examples/annotated/) | Runnable YAML **with inline tutorial comments** (`01_getting_started.yaml`, fault injection, full scenario) |

## License

MIT
