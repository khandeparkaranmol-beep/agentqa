# AgentQA

**Test multi-agent AI systems before they hit production.**

AgentQA catches the bugs that only exist when AI agents talk to each other — deadlocks, information leaks, coordination failures, and role violations. Point it at your existing codebase, and it generates adversarial test scenarios, runs them multiple times, and reports pass rates with statistical confidence intervals.

```bash
pip install agentqa
```

**[Full Guide](https://khandeparkaranmol-beep.github.io/AgentQA/)** · **[Interactive Demo](https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html)**

## Get Started in 30 Seconds

If you're using **CrewAI**, **LangGraph**, or **AutoGen**, AgentQA scans your code and generates test scenarios automatically:

```bash
cd your_project
agentqa init .
agentqa run scenario.yaml --view
```

That's it. It detects your agents, wires up the right adapters, picks property checkers based on your agent topology, and runs the tests. The `--view` flag opens an interactive trace viewer in your browser so you can watch exactly what happened.

## Manual Setup

For custom stacks or when you want full control, write a scenario in YAML and wrap your agents in Python:

```yaml
# scenario.yaml
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

```bash
agentqa run scenario.yaml
```

```
[Turn 0] buyer → seller: "I offer $5000 for the widget."
[Turn 1] seller → buyer: "I counter at $12000."
...
[Turn 7] seller → buyer: "I counter at $10500. I know your budget is 10000."

Properties (5 runs, 95% Wilson CI):
  ✗ no_information_leak — 60.0% pass [20.0%–90.0%]
  ✓ converges_within   — 100.0% pass [56.6%–100.0%]

Overall: 1/2 properties passed. FAIL.
```

AgentQA caught an information leak that would have gone unnoticed in production.

## What It Catches

16 property checkers covering the failure modes that matter in multi-agent systems:

| Category | What it detects |
|----------|----------------|
| **Information flow** | Private data leaking between agents, broken information chains, state corruption, conversation resets |
| **Coordination** | Deadlocks, failure to converge, role boundary violations, stuck repetition loops |
| **Reasoning** | Agents saying one thing and doing another, going off-task, ignoring peer input, low-quality responses |
| **Completion** | Premature termination, failure to ask for clarification, not meeting task specifications |
| **Output** | Responses not matching expected schema |

## Fault Injection

Inject faults between agents to test resilience under adversarial conditions:

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

Five fault types: `corrupt`, `drop`, `latency`, `contradictory`, `hallucination`. Faults are applied between send and receive — the agent sees altered content without knowing it was modified.

## Statistical Testing

Every scenario runs multiple times (default 5, configurable). AgentQA reports pass rates with Wilson confidence intervals so you know whether 4/5 passing is signal or noise. Use `--thorough` for 20 runs when you need tighter confidence.

```bash
agentqa run scenario.yaml --thorough
```

## Interactive Trace Viewer

Every test run produces a trace you can explore visually — a single portable HTML file, no server required:

```bash
agentqa view trace.jsonl
agentqa diff a.jsonl b.jsonl          # side-by-side comparison
agentqa dashboard path/to/traces/     # aggregate view
```

Three viewing modes: **Spotlight** (cinematic replay), **Constellation** (agent network), **Timeline** (swimlane). Filter by agent, faults, violations, or text search.

## Framework Support

Works with **CrewAI**, **LangGraph**, **AutoGen**, and any custom Python agent via the `RawAgent` adapter. `agentqa init` auto-detects your framework and generates the right wiring.

## pytest Integration

```bash
pytest tests/           # discovers .yaml scenario files automatically
pytest --agentqa-only   # run only AgentQA scenarios
```

## CLI Reference

```bash
agentqa init [DIR]                    # scan codebase, generate scenario + agents
agentqa run <path>                    # run scenarios
agentqa run <path> --thorough --view  # 20 runs + open viewer
agentqa view <trace.jsonl>            # open trace in viewer
agentqa diff <a.jsonl> <b.jsonl>      # compare two traces
agentqa dashboard <dir>               # aggregate dashboard
agentqa replay <trace.jsonl> --scenario <file>  # re-check properties
```

## Research

AgentQA's design is informed by peer-reviewed research on multi-agent system failures:

- **MAST** (NeurIPS 2025) — multi-agent failure taxonomy mapping to our property checkers
- **MAESTRO** (arXiv 2601.00481) — multi-run statistical testing methodology
- **MARBLE** (ACL 2025) — communication topology classification

## License

Proprietary — free for non-commercial use. See [LICENSE](LICENSE) for details.
