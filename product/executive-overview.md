# AgentQA v0.1 — Executive Overview

*May 2026*

---

## What AgentQA Does

AgentQA is a testing framework for multi-agent AI systems. It lets developers simulate how their AI agents interact with each other under adversarial conditions before deploying to production — catching coordination failures in a test suite instead of in front of users.

A developer writes a YAML scenario that describes "what should happen" (two agents negotiate a price, three agents collaborate on research), runs `agentqa run scenario.yaml`, and gets back a report: which properties held, which violated, on which turn, with full evidence. The entire thing runs locally on the developer's machine — no accounts, no servers, no data leaving the building.

---

## The Problem We Solve

The AI industry is moving from single-agent to multi-agent architectures. CrewAI, LangGraph, AutoGen, and Google's A2A protocol are driving a 327% growth in multi-agent deployments over the past 4 months. But there is no commercial tool for testing how agents interact with each other.

Every existing tool — LangSmith, LangWatch, Maxim AI — tests individual agents against simulated users. None of them test what happens when Agent A talks to Agent B, and Agent B misinterprets Agent A's output, and Agent C makes a decision based on that misinterpretation. These are the bugs that break production systems.

The evidence for this gap is concrete:

**Production bugs are real and documented.** CrewAI's GitHub has issues for hierarchical delegation silently degrading to sequential execution (#4783), agents fabricating tool invocations (#3154), and response format corruption during agent-to-agent communication (#3873). AutoGen's discussions show developers struggling with fragmented state across multi-agent conversations (#7144). In July 2025, a Replit AI agent deleted a production database with 1,200+ records despite explicit instructions not to.

**Academia considers this unsolved.** Four independent research groups published multi-agent evaluation frameworks within 12 months (MAESTRO, MultiAgentBench, MASEval, AgentBench). When multiple academic teams independently converge on the same problem, it signals the problem is real, important, and unsolved.

**The failure modes are now taxonomized.** The MAST paper (UC Berkeley, NeurIPS 2025) analyzed 1,600+ annotated traces across 7 multi-agent frameworks and identified 14 distinct failure modes in 3 categories: specification/system design issues (41.8% of failures), inter-agent misalignment (36.9%), and task verification/termination failures (21.3%). AgentQA's property checkers are mapped directly to this taxonomy.

**No commercial tool addresses this.** LangWatch raised €1M for agent testing — but tests single agents. Maxim AI raised $3M — also single agents. Every tool in the market tests Agent vs. Simulated User. AgentQA tests Agent vs. Agent.

---

## What v0.1 Contains

v0.1 is a Python library and CLI tool, installable via `pip install agentqa`. It comprises 1,668 lines of production code and 465 lines of tests across 29 files. Here is what shipped:

### Core Engine

The simulation engine orchestrates multi-agent interactions in a controlled environment. It manages turn-taking (round-robin), routes all communication between agents (agents never call each other directly — all messages flow through the engine), records every message and state change to a structured trace, and runs each scenario N times (default 5) to handle LLM non-determinism. Multi-run testing is a core design choice, not an add-on — the MAESTRO paper demonstrated that single-run evaluation creates false confidence due to high temporal variance in multi-agent systems.

### Agent Adapter Layer

The `AgentUnderTest` abstract class defines a two-method contract: `receive(message) → response` and `get_state() → dict`. This is deliberately minimal — any agent, regardless of framework, can implement these two methods and become testable. The `RawAgent` adapter ships in v0.1 for wrapping plain Python functions. CrewAI and LangGraph adapters are on the v0.2 roadmap.

The adapter contract is the most important interface in the system. It is intentionally thin because the cost of a complex adapter is that developers won't bother wrapping their agents. The tax on adoption must be near zero.

### Scenario DSL

Test scenarios are expressed in YAML — declarative descriptions of what to test, not how to test it. A scenario defines which agents participate, how many turns to run, what private data each agent holds, what faults to inject, and what properties to assert. YAML was chosen over Python for three reasons: non-engineers (PMs, QA) can read and write scenarios, scenarios are diffable in git (you can review scenario changes in a PR), and the declarative format forces developers to think about WHAT to test rather than HOW.

### Five Property Checkers

Property checkers are stateless functions that analyze a completed trace and report whether an invariant held. They are the automated assertions for multi-agent behavior — the equivalent of `assert` statements for agent interactions.

**`no_information_leak`** — Verifies that data marked as private to one agent never appears in messages to other agents. The most unique checker in AgentQA — this failure mode is not even in the MAST academic taxonomy (which focused on functional correctness, not security). Built because GitHub signal mining showed information leakage as a top developer concern. Implementation: extracts private fields from scenario setup per agent, scans all trace messages for cross-agent substring matches (case-insensitive).

**`converges_within`** — Checks that the interaction reaches a completion state within N turns. Detects both metadata-signaled completion (`done: true`) and content-based markers ("agreed", "deal", "settled"). Maps to MAST's FM-1.3 (step repetition, 13.2% of failures) and FM-1.5 (unaware of termination, 6.2%).

**`no_deadlock`** — Detects two patterns: all agents sending identical messages (total stall) and two agents alternating the same message pair in a ping-pong loop. Uses configurable lookback window (default 4 messages). This failure mode is not in the MAST taxonomy — unique to AgentQA, sourced from production incident reports.

**`role_boundary`** — Verifies that agents stay within their assigned roles. A scenario defines forbidden actions per agent (e.g., an auditor must never send "I offer" or "I accept"). The checker scans that agent's messages for forbidden substrings. Maps directly to MAST's FM-1.2 (disobey role specification, 1.5% of failures).

**`output_schema`** — Validates that the final collective output conforms to a JSON schema. Catches both non-JSON output and structurally invalid output. Implements lightweight schema validation (type checking + required fields) without a full JSON Schema library dependency. Maps to MAST's FM-3.2 (incomplete verification, 11.8%) and FM-3.3 (incorrect verification, 2.2%).

### CLI and pytest Integration

Two interfaces for running tests:

The CLI (`agentqa run scenarios/`) is the developer's primary interface. It supports running single files or directories of scenarios, configurable run counts, a `--thorough` flag for 20-run statistical testing (aligned with MAESTRO methodology), a `--threshold` flag for handling LLM non-determinism (a property passes if its pass rate exceeds the threshold), and colored terminal output with per-run and aggregate statistics. Exit code 0 on all-pass, 1 on any failure — ready for CI/CD.

The pytest plugin discovers YAML scenario files as test cases automatically. `pytest examples/ -v` finds and runs scenarios without any additional configuration. This is the "fits into your existing workflow" moment — AgentQA becomes just another test in the developer's CI pipeline.

### Trace Output

Every simulation run produces a full trace in JSON Lines format (one event per line). The trace records every message sent, every state change, every fault injected, and every property check result. JSONL was chosen because it is streamable (can be tailed in real-time), appendable (no need to keep the full trace in memory), and parseable by every language and tool. Human-readable terminal output is also generated during runs for immediate debugging.

---

## Architecture

```
Developer's Machine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                          
  Scenario YAML ──→ Scenario Loader       
                        │                 
                        ▼                 
  Agent Python  ──→ Agent Registry        
  (agents.py)       │                     
                    ▼                     
              ┌──────────────┐            
              │  Simulation  │            
              │   Engine     │            
              │              │            
              │  turn mgmt   │            
              │  msg routing  │            
              │  state track  │            
              │  trace record │            
              └──────┬───────┘            
                     │                    
           ┌─────────┴─────────┐          
           ▼                   ▼          
   Property Checkers     Trace Output     
   (5 invariants)        (.jsonl + terminal)
           │                              
           ▼                              
   Run Summary                            
   (pass rates, evidence)                 
                                          
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LLM APIs (user's own keys, called       
  by user's agents — not by AgentQA)      
```

The architecture enforces a strict principle: **the engine owns all communication.** Agents never talk to each other directly. Every message from Agent A to Agent B routes through the engine, which records it to the trace before delivering it. This makes the trace a complete, faithful record of everything that happened — which is what makes property checking possible.

AgentQA's own code is entirely deterministic. It contains zero LLM calls. The non-determinism comes from the developer's agents (which may call LLMs internally). AgentQA handles this non-determinism through multi-run statistical testing, not by trying to make LLM calls reproducible.

---

## Key Design Decisions

### 1. Library, not service

AgentQA runs entirely on the developer's machine. No servers, no accounts, no data leaving the building. This was chosen for three reasons: zero hosting costs (critical for a side project), zero adoption friction (`pip install agentqa` and you're testing), and zero privacy concerns (the developer's proprietary agent code never leaves their machine). The commercial layer (hosted CI, team features) comes later as an optional add-on.

### 2. Multi-run by default

Every scenario runs N times (default 5) and reports statistics, never a single pass/fail. This follows MAESTRO's methodology, which found that multi-agent systems exhibit "structural stability but temporal variability" — the same agents do roughly the same things, but in different orders across runs, producing different outcomes. Single-run testing creates false confidence. The `--thorough` flag runs 20 times for production-grade confidence.

### 3. Threshold-based assertions

The `--threshold` flag (default 1.0) determines what pass rate counts as "passing." At `--threshold 0.8`, a property is considered passing if it holds in 4 out of 5 runs. This is essential for LLM-powered agents where some non-determinism is expected and unavoidable. Without this, every flaky test becomes a false alarm that erodes trust in the tool.

### 4. The adapter contract is sacred

Two methods: `receive(message) → response` and `get_state() → dict`. Nothing more. The thinner the adapter, the lower the barrier to wrapping any agent framework. If we required developers to rewrite their agents to fit AgentQA's model, adoption would die. The two-method contract can wrap CrewAI crews, LangGraph graphs, raw API calls, or anything else.

### 5. Property checkers are stateless

Each property checker receives a complete trace and returns a result. Checkers do not modify state, maintain internal memory, or depend on each other. This makes them composable (add as many as you want to a scenario), testable (each checker can be unit-tested with a synthetic trace), and extensible (third parties can write custom checkers without understanding AgentQA internals).

### 6. Scenarios are data, not code

YAML scenarios describe WHAT to test. The engine decides HOW. This separation means scenarios are reviewable (a PM can read a scenario in a PR), version-controlled (git diff works on YAML), and machine-generatable (v0.2 will add LLM-powered scenario generation — easy because scenarios are structured data, not arbitrary code).

---

## Research Foundations

AgentQA is not built on intuition. Every property checker is mapped to the MAST failure taxonomy (NeurIPS 2025), and the statistical methodology follows MAESTRO (arXiv 2601.00481).

v0.1's five property checkers cover approximately 25% of MAST's failure frequency directly and 20% partially. The product roadmap maps all 14 MAST failure modes to specific property checkers across versions v0.1 through v0.4, reaching 95%+ coverage.

Two of AgentQA's property checkers (`no_information_leak` and `no_deadlock`) cover failure modes that the MAST academic taxonomy does not include — these were sourced from production incident reports and GitHub issue mining, not academic papers. This represents a differentiated contribution beyond the existing academic literature.

---

## Known Gaps in v0.1

These are intentional — scoped out for speed, scheduled for future versions:

1. **Fault injection is stubbed.** The three fault modules (corrupt, drop, latency) contain only import statements. The engine has no code to apply faults during simulation. Scheduled for v0.3.

2. **Framework adapters not yet implemented.** CrewAI and LangGraph adapters are on the v0.2 roadmap. v0.1 ships only the `RawAgent` adapter for plain Python functions.

3. **`__init__.py` does not export public API.** Developers must import from submodules (`from agentqa.agent import AgentUnderTest`) rather than the top-level package. Minor developer experience issue.

4. **Output schema validation is lightweight.** Uses a custom minimal validator instead of a full JSON Schema library. Sufficient for v0.1 but will need upgrading for complex schemas.

5. **Agent loading logic is duplicated** between cli.py and pytest_plugin.py. A minor code quality issue to clean up.

6. **No web-based trace viewer.** All output is terminal-only. The visual replay viewer is planned for v0.5.

---

## Success Metrics

### Adoption (Month 1-3)

| Metric | Target | Why This Number |
|---|---|---|
| GitHub stars | 200+ by month 2 | Signals developer interest. Below 100 = insufficient awareness or weak value prop. |
| PyPI downloads | 500+ by month 3 | Stars don't mean usage. Downloads indicate people are actually trying it. |
| GitHub issues filed by external users | 10+ by month 2 | People filing issues means they're using it seriously enough to hit edges. |
| External blog posts / tweets | 3+ by month 2 | Organic mentions signal genuine value, not just curiosity. |

### Validation (Month 2-4)

| Metric | Target | Why This Number |
|---|---|---|
| Developer interview WTP | $200+/month from 3+ interviewees | Validates commercial viability. Below $100 suggests "nice to have" not "need to have." |
| Community post responses | 20+ across 4 communities | Quantifies awareness of the problem, not just the tool. |
| CI pipeline integrations | 5+ teams using in CI | The ultimate adoption signal — embedded in the workflow. |

### Product Quality (Ongoing)

| Metric | Target | Why This Number |
|---|---|---|
| Property checker false positive rate | <5% | False alarms erode trust. If the tool cries wolf, developers disable it. |
| Test suite pass rate (our own tests) | 100% on every commit | Dogfooding. If our own tests don't pass, we can't ask others to trust theirs. |
| Time to first test run | <5 minutes from pip install | Adoption dies at friction. If setup takes 30 minutes, 80% of developers leave. |
| MAST failure mode coverage | 25% at v0.1, 95% by v0.4 | Research-grounded completeness metric. |

### Commercial Readiness (Month 6+)

| Metric | Target | Why This Number |
|---|---|---|
| GitHub stars | 1,000+ | Threshold for "this is a real project" in developer perception. |
| Active Discord/Slack community | 50+ members | Community = distribution channel + feedback loop. |
| Paying design partners | 3+ teams | Pre-revenue validation before building the commercial layer. |
| Clear feature requests for paid tier | Team sharing, hosted CI | Signals what the market will pay for, not what we guess they'll pay for. |

---

## Competitive Position

AgentQA occupies a category of one: multi-agent interaction testing. The competitive landscape is adjacent competitors, not direct ones.

| Competitor | What They Do | What They Don't Do |
|---|---|---|
| LangSmith | Trace individual agent runs | Test agent-to-agent interactions |
| LangWatch / Scenario | Simulate users to test single agents | Simulate agents interacting with each other |
| Maxim AI | Agent simulation + observability | Multi-agent coordination testing |
| Langfuse | Open-source LLM observability | Any form of pre-deployment testing |
| MAESTRO (academic) | Research evaluation framework | Commercial product usable by developers |

AgentQA's positioning: "Every tool tests your agent against simulated users. AgentQA tests your agents against each other."

---

## What Comes Next

The product roadmap (see `product/roadmap.md`) covers v0.1 through v1.0:

- **v0.2 (weeks 5-8):** Information flow checkers, web trace viewer, CrewAI/LangGraph/AutoGen adapters, cost tracking. Covers ~65% of MAST failure frequency.
- **v0.3 (weeks 9-12):** Reasoning validation, advanced fault injection, communication quality scoring. ~80% MAST coverage.
- **v0.4 (weeks 13-16):** Task completion checkers, milestone-based metrics, MAST-compatible trace export. ~95% MAST coverage.
- **v0.5 (months 5-6):** Interactive web trace viewer, trace diffing, shareable trace links. Open-source / commercial inflection point.
- **v1.0 (months 7-12):** Hosted CI runner, team collaboration, historical analytics, alerting. Commercial product launch.

The immediate next step: merge v0.1 to main, publish to PyPI, post on Hacker News and the communities identified in the validation plan, and start developer interviews.
