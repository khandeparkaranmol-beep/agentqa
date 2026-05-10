# AgentQA

**Test multi-agent AI systems before they hit production.**

AgentQA simulates how your agents interact under hundreds of scenarios — catching deadlocks, information leaks, cascading failures, and role violations in your test suite instead of in production.

```bash
pip install agentqa
```

## 60-Second Quickstart

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

## Why AgentQA?

Existing tools (LangSmith, LangWatch, Maxim) test **individual agents** against simulated users. Nothing tests **agent-to-agent interactions** — the coordination bugs, the information leaks, the deadlocks that only emerge when multiple agents talk to each other.

AgentQA is the first tool built specifically for this. It is informed by peer-reviewed research:

- **MAST** (NeurIPS 2025) — 14 empirically-derived multi-agent failure modes. AgentQA has property checkers covering ~95% of failure frequency.
- **MAESTRO** (arXiv 2601.00481) — Multi-run statistical testing. AgentQA runs every scenario N times and reports pass rates, not single-run pass/fail.
- **MARBLE** (ACL 2025) — Communication topology benchmarking. AgentQA auto-classifies star/chain/tree/mesh topologies from traces.

## What It Catches

AgentQA ships 15 property checkers across 4 failure categories:

| Category | Checkers | Example Failure |
|---|---|---|
| **Information flow** | `no_information_leak`, `ensures_information_flow`, `state_continuity`, `no_conversation_reset` | Agent B sees Agent A's private budget |
| **Coordination** | `no_deadlock`, `converges_within`, `role_boundary`, `step_repetition` | Two agents wait for each other forever |
| **Reasoning** | `reasoning_action_consistency`, `stays_on_task`, `respects_peer_input`, `communication_quality` | Agent says "I'll check the database" then doesn't |
| **Completion** | `no_premature_termination`, `asks_for_clarification`, `task_specification_compliance` | Agent declares "done" before finishing the task |

## Fault Injection

Test how your agents handle adversarial conditions:

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

Five fault types: `corrupt`, `drop`, `latency`, `contradictory`, `hallucination`.

## Interactive Trace Viewer

Export any trace to a self-contained HTML file with an interactive swimlane diagram:

```bash
agentqa view trace.jsonl          # export + open in browser
agentqa diff a.jsonl b.jsonl      # side-by-side comparison
agentqa dashboard traces/         # aggregate dashboard
```

The viewer includes:
- **Animated replay** — step through turns one by one with play/pause controls
- **Agent state timeline** — see how each agent's internal state evolved
- **Filter & search** — filter by agent, fault type, violation, or message content
- **Keyboard shortcuts** — arrow keys to step, Space to play/pause

## Framework Adapters

Works with any Python agent framework:

```python
# Raw Python callable (zero dependencies)
from agentqa.adapters.raw import RawAgent

# CrewAI
from agentqa.adapters.crewai import CrewAIAgent

# LangGraph
from agentqa.adapters.langgraph import LangGraphAgent

# AutoGen
from agentqa.adapters.autogen import AutoGenAgent
```

The adapter contract is two methods: `receive(message) -> response` and `get_state() -> dict`.

## pytest Integration

AgentQA scenarios run as pytest tests:

```bash
pytest examples/           # discovers .yaml scenario files
pytest --agentqa-only      # only run AgentQA scenarios
```

```python
# Or programmatically:
def test_no_leaks():
    engine = SimulationEngine(agents, scenario)
    traces = engine.run()
    summary = engine.summarize(traces)
    assert summary.overall_pass_rate >= 1.0
```

## CLI Reference

```bash
agentqa run <path>              # run scenarios (file or directory)
agentqa run <path> --runs 20    # override run count
agentqa run <path> --thorough   # shorthand for --runs 20
agentqa view <trace.jsonl>      # interactive HTML viewer
agentqa diff <a> <b>            # side-by-side trace diff
agentqa dashboard <dir>         # aggregate dashboard
agentqa export <trace> --format html|mast
agentqa replay <trace> --scenario <yaml>
```

## Examples

See [`examples/`](examples/) for complete working scenarios:

- **negotiation/** — Buyer/seller price negotiation with intentional information leak
- **task_delegation/** — Coordinator/executor/reviewer with fault injection
- **task_completion/** — Two-agent handoff with milestones
- **adversarial_agent/** — Agent resilience under contradictory instructions

## License

MIT
