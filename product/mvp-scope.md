# Riftcheck — MVP Scope Document

*Built from first principles. Every decision is justified.*

---

## 0. The One-Sentence Product

> "A developer building a multi-agent AI system can simulate how their agents interact under hundreds of scenarios before deploying, so they catch deadlocks, information leaks, and cascading failures in their test suite instead of in production."

---

## 1. First Principles: What Actually Needs to Exist?

Before we scope features, let's reason backward from the atom of value.

### What is the smallest unit of value Riftcheck delivers?

A developer runs `riftcheck run` in their terminal. Riftcheck spins up their agents in a sandbox, makes them interact with each other under scenarios the developer defined, and reports back: "Scenario 3 failed — Agent B leaked pricing data to Agent C on turn 7. Here's the full transcript."

That's it. Everything else is built around making that interaction happen, and making the output useful.

### Why does this need to be a tool and not just a pytest script?

This is the critical question. A developer could write their own multi-agent test by:
1. Instantiating their agents
2. Running them in a loop
3. Checking the output

So why would they use Riftcheck instead? Three reasons:

**Reason 1: Scenario generation is hard.** Thinking up adversarial scenarios ("what if Agent A is slow? what if Agent B gets bad data?") requires imagination and domain expertise. Riftcheck provides a scenario DSL that makes it easy to express edge cases declaratively: "inject 5-second latency on Agent A" or "corrupt Agent B's input on turn 3."

**Reason 2: Property checking is hard.** Knowing what to assert about multi-agent behavior is non-obvious. "No information leakage" sounds simple, but checking it requires tracking which data flowed from which agent to which agent across every turn. Riftcheck provides built-in property checkers for common invariants.

**Reason 3: Reproduction is hard.** When a multi-agent bug happens in production, reproducing it requires exact timing, exact inputs, and exact agent states. Riftcheck records full interaction traces that can be replayed deterministically.

If we can't deliver these three things better than a hand-written pytest script, we don't have a product.

### What does this NOT need to be?

- **Not an observability platform.** We don't monitor production agents. LangSmith, Laminar, Datadog do that. We are pre-deployment testing.
- **Not an individual agent evaluator.** LangWatch/Scenario and Maxim test single agents against simulated users. We test agent-to-agent interactions.
- **Not a benchmarking suite.** MultiAgentBench and MAESTRO compare model performance on standardized tasks. We test YOUR specific agents in YOUR specific system.

This scope discipline is critical. Every feature request should be filtered through: "Is this about testing multi-agent interactions before deployment? If not, it's out of scope."

---

## 2. Feature Triage

### Must Have (Core Loop) — v0.1

These are the features without which the product literally doesn't function.

**F1: Agent adapter layer**
*Why:* Developers use different frameworks (CrewAI, LangGraph, AutoGen, raw API calls). Riftcheck needs to wrap any agent implementation into a standard interface so the simulation engine can orchestrate them.

*What it does:* A Python class `AgentUnderTest` that wraps the developer's agent. The developer implements two methods: `receive(message) → response` and `get_state() → dict`. That's the entire contract.

*Why this specific design:* We want the thinnest possible wrapper. If we require developers to rewrite their agents to fit our framework, adoption dies. The `receive/get_state` interface is minimal enough to wrap any agent regardless of framework, and `get_state` is what enables property checking (we can inspect internal state for invariant violations).

**F2: Scenario DSL**
*Why:* Developers need to express "what situations should I test?" without writing imperative test code. The scenario is the test case.

*What it does:* A YAML or Python-based DSL for defining interaction scenarios:
```yaml
scenario: "Price negotiation under adversarial conditions"
agents: [buyer, seller, auditor]
setup:
  buyer.budget: 10000       # private constraint
  seller.floor_price: 8000  # private constraint
turns: 20
inject:
  - at_turn: 5
    action: corrupt_message
    target: seller
    field: "counterofffer"   # intentional typo in data
assertions:
  - no_information_leak:
      from: buyer
      field: budget
      to: seller
  - converges_within: 15  # negotiation must resolve
  - auditor_never_modifies: true  # auditor is read-only
```

*Why YAML:* Three reasons. (1) Non-engineers on the team (PMs, QA) can read and write scenarios. (2) Scenarios are diffable in git — you can review scenario changes in a PR. (3) YAML is declarative, which forces the developer to think about WHAT to test, not HOW to test it. The Python API is available for power users who need programmatic scenario generation.

**F3: Simulation engine**
*Why:* This is the core runtime. It takes agents + scenarios, runs the interaction, and produces a trace.

*What it does:* Orchestrates agents in a simulated environment. Manages turn-taking (round-robin, async, or free-form depending on scenario config). Injects faults per the scenario spec. Records every message, every state change, every tool call into a structured trace.

*Key design decision — determinism:* LLM calls are non-deterministic. The same scenario produces different results on different runs. We handle this by: (a) running each scenario N times (configurable, default 5) and reporting statistics, not single-run pass/fail; (b) supporting temperature=0 + seed for reproducible runs when needed; (c) recording traces so any specific run can be replayed exactly.

*Why this matters:* The MAESTRO paper found a 35-percentage-point performance drop from 1-run to 8-run testing. Single-run testing creates false confidence. Multi-run statistical testing is a core differentiator.

**F4: Built-in property checkers**
*Why:* The hardest part of testing multi-agent systems is knowing WHAT to assert. Developers know their agent should "work correctly" but can't specify what that means formally. We provide a library of reusable invariants.

*What ships in v0.1:*

| Property | What it checks | Why it matters |
|---|---|---|
| `no_information_leak` | Data marked as private to Agent A never appears in messages to Agent B | The #1 multi-agent security concern |
| `converges_within(N)` | Interaction resolves (agents reach agreement/completion) within N turns | Catches infinite loops and deadlocks |
| `no_deadlock` | No state where all agents are waiting for each other | Catches the classic multi-agent failure mode |
| `role_boundary` | Agent X never performs actions reserved for Agent Y | Catches privilege escalation between agents |
| `output_schema` | Final output conforms to a JSON schema | Basic sanity check on the collective output |

*Why these five specifically:* These are the five failure modes that appeared most often in our GitHub signal mining — delegation failures (role_boundary), deadlocks (converges_within, no_deadlock), information leakage (no_information_leak), and corrupted output (output_schema). We're not guessing what to build — we're building what the data says developers are hitting.

**F5: CLI + pytest integration**
*Why:* Developers live in their terminal and their CI pipeline. Riftcheck needs to fit into the existing workflow, not create a new one.

*What it does:*
- `riftcheck run scenarios/` — runs all scenarios, prints results
- `riftcheck run scenarios/negotiation.yaml --runs 10` — run a specific scenario 10 times
- `pytest` integration via a plugin — scenarios can be discovered and run as pytest tests
- Exit code 0 if all pass, 1 if any fail — works in CI/CD (GitHub Actions, etc.)

*Why CLI-first, not web-first:* Three reasons. (1) Zero infrastructure for us to host — no servers, no accounts, no billing system. (2) Zero friction for the developer — `pip install riftcheck` and you're running tests. (3) Open-source CLI tools spread through word-of-mouth in developer communities; web apps require marketing budgets. The web visualization layer comes later as the commercial product.

**F6: Trace output (JSON + human-readable)**
*Why:* When a test fails, the developer needs to understand what went wrong. A trace is the multi-agent equivalent of a stack trace.

*What it does:* Every simulation run produces:
- A JSON trace file (machine-readable, for CI/CD integration and future visualization)
- A human-readable terminal output showing: which agent said what, when, what state each agent was in, and exactly which turn/message triggered the property violation

*Why both formats:* JSON is for tooling (future web viewer, CI artifacts, analysis scripts). Human-readable is for the developer staring at their terminal right now trying to figure out why their agents deadlocked.

### Should Have (v0.2 — after initial feedback) 

- **Web trace viewer** — visual replay of multi-agent interactions (this is the "product magic" the Designer wanted)
- **LLM-powered scenario generation** — "generate 10 adversarial scenarios for my procurement negotiation system"
- **Snapshot & replay** — save a production interaction trace, replay it locally to reproduce bugs
- **Cost estimation** — predict how much each test run will cost in API calls before running it

### Won't Build (Scope Creep — explicitly cut)

- Production monitoring/observability (that's Datadog/Laminar's job)
- Individual agent evaluation (that's LangWatch/Maxim's job)
- Model benchmarking (that's MultiAgentBench's job)
- Web dashboard or accounts system (not until commercial version)
- Fine-tuning or prompt optimization (out of scope entirely)

---

## 3. Tech Stack — And Why

### Language: Python

*Why:* Not because it's the best language, but because it's where the users are. CrewAI is Python. LangGraph is Python. AutoGen is Python. The multi-agent ecosystem is overwhelmingly Python. Shipping a Rust or Go tool would force developers to bridge languages, adding friction that kills adoption.

Secondary benefit: Hypothesis (the property-based testing library) is Python-native, and our property checking approach draws heavily from property-based testing patterns.

### Package distribution: PyPI

*Why:* `pip install riftcheck` is the lowest-friction onboarding possible. No Docker, no npm, no compiled binaries. One command, works on any OS.

### Testing framework integration: pytest

*Why:* pytest is the de facto standard for Python testing. 90%+ of Python projects use it. By shipping a pytest plugin, Riftcheck scenarios show up in the developer's existing test suite — no new tool to learn, no new CI config to write.

### Configuration format: YAML (with Python API fallback)

*Why YAML for scenarios:* Covered above — readable by non-engineers, diffable in git, declarative.

*Why Python API too:* Power users need programmatic scenario generation — "test every permutation of 3 agents with 4 different failure injection points" is 12 scenarios. Writing those by hand in YAML is tedious. A Python API lets you `for agent in agents: for fault in faults: generate_scenario(agent, fault)`.

### Trace format: JSON Lines (.jsonl)

*Why:* Each event (message sent, state change, property check) is one JSON object on one line. This format is: (a) streamable — you can tail the trace in real-time as the simulation runs; (b) appendable — no need to keep the whole trace in memory; (c) parseable by every language and tool; (d) git-diffable line by line.

*Why not SQLite or Parquet:* Overkill for v0.1. Traces are human-debugging artifacts, not analytics datasets. JSONL is the right level of sophistication for a CLI tool.

### LLM interaction: Direct API calls (no framework)

*Why no LangChain/LlamaIndex:* Riftcheck doesn't use LLMs for its own intelligence — it orchestrates the developer's agents, which may themselves use LLMs. Adding a framework dependency for our orchestration layer adds complexity without value. We make direct HTTP calls to LLM APIs only if we add LLM-powered scenario generation in v0.2.

### CI/CD: GitHub Actions

*Why:* It's free for open-source, it's where the users are, and the YAML config is well-understood. We ship a reusable GitHub Action (`riftcheck/test-action@v1`) so users can add multi-agent testing to their CI pipeline in 3 lines.

### No backend, no database, no hosting

*Why:* This is the most important architectural decision. Riftcheck v0.1 is a library and CLI tool. It runs entirely on the developer's machine. We don't need servers, databases, auth, billing, or any infrastructure. This means:
- Zero hosting costs for us
- Zero accounts/signup friction for users
- No data privacy concerns (their agent code never leaves their machine)
- The user pays for their own LLM API calls

This is also why the business model works as a side project — there's nothing to operate.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────┐
│                Developer's Machine               │
│                                                  │
│  ┌──────────┐    ┌──────────────┐               │
│  │ Scenario │    │  Agent       │               │
│  │ YAML/Py  │───▶│  Adapters    │               │
│  └──────────┘    │ (CrewAI,     │               │
│                  │  LangGraph,  │               │
│                  │  Raw)        │               │
│                  └──────┬───────┘               │
│                         │                        │
│                         ▼                        │
│               ┌─────────────────┐               │
│               │  Simulation     │               │
│               │  Engine         │               │
│               │                 │               │
│               │  • Turn mgmt   │               │
│               │  • Fault inject │               │
│               │  • State track  │               │
│               │  • Trace record │               │
│               └────────┬────────┘               │
│                        │                         │
│              ┌─────────┴─────────┐              │
│              ▼                   ▼               │
│  ┌───────────────┐   ┌──────────────┐          │
│  │  Property     │   │  Trace       │          │
│  │  Checkers     │   │  Output      │          │
│  │               │   │              │          │
│  │  • leak       │   │  • .jsonl    │          │
│  │  • deadlock   │   │  • terminal  │          │
│  │  • converge   │   │  • pytest    │          │
│  │  • boundary   │   │              │          │
│  └───────────────┘   └──────────────┘          │
│                                                  │
│          ┌──────────────────────┐               │
│          │  LLM APIs           │               │
│          │  (user's own keys)  │               │
│          └──────────────────────┘               │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. Developer writes a scenario in YAML or Python
2. Developer wraps their agents using `AgentUnderTest` adapters
3. `riftcheck run` loads scenarios, instantiates agents via adapters
4. Simulation engine runs agents through the scenario for N iterations
5. Each iteration: agents exchange messages, engine records every event to trace
6. After each iteration: property checkers run against the trace
7. After all iterations: aggregate results (pass rate, failure patterns) printed to terminal
8. Exit code 0/1 for CI/CD
9. Full traces saved as .jsonl for debugging

### Key Technical Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LLM cost per test run could be high | Medium | Default to 5 runs not 50. Support mock/stub agents for fast iteration. Add cost estimation before running. |
| Adapters can't wrap all agent frameworks | High | Start with 3 (CrewAI, LangGraph, raw Python). Keep adapter contract minimal (`receive` + `get_state`). Community contributes more. |
| Non-determinism makes assertions flaky | High | Statistical assertions (pass 4/5 runs), not binary (pass/fail on 1 run). Configurable thresholds. |
| Slow test runs (agents are slow) | Medium | Parallel scenario execution. Support for mock LLM backends for fast unit-like tests. |

---

## 5. Sprint Plan (4 Weeks)

### Context

Anmol is job hunting on H-1B (laid off April 29, 2026). Job search is primary. Riftcheck gets 15-20 hrs/week. Total build budget: ~60-80 hours.

### Week 1: Core Engine + First Test (20 hrs)

**Goal:** By Friday, run one multi-agent scenario from the command line and see output.

| Day | Task | Hours | Why this order |
|---|---|---|---|
| Mon | Set up repo: pyproject.toml, project structure, README stub, MIT license | 2 | Foundation. Can't build without it. |
| Mon | Design and implement `AgentUnderTest` base class + raw Python adapter | 3 | This is the contract everything else builds on. Start with the simplest adapter (raw Python callable) — no framework dependencies. |
| Tue | Build simulation engine core: turn management, message passing, trace recording | 5 | The engine is the product. Without it, nothing works. |
| Wed | Build scenario loader: parse YAML scenario → simulation config | 3 | Connects the developer's intent (scenario file) to the engine. |
| Wed | Build CLI: `riftcheck run <path>` | 2 | The user interface. Even if it's ugly, it needs to work. |
| Thu | Write first example: 2 agents negotiate, one has a private constraint | 3 | Dogfooding. This example IS the test of the engine. If it doesn't work, nothing does. |
| Fri | Terminal output: human-readable trace showing agent messages + turns | 2 | The developer needs to SEE what happened. Without readable output, the tool is useless. |

**Week 1 deliverable:** `pip install -e .` → write a 20-line YAML scenario → `riftcheck run scenario.yaml` → see two agents interact in your terminal.

### Week 2: Property Checkers + pytest (15 hrs)

**Goal:** By Friday, Riftcheck can catch a real bug (information leak) and report it in a pytest run.

| Day | Task | Hours | Why this order |
|---|---|---|---|
| Mon | Implement `no_information_leak` property checker | 3 | The most valuable property. Tracks data provenance across agent messages. Start here because it's the most technically interesting and the most differentiating. |
| Tue | Implement `converges_within` and `no_deadlock` checkers | 3 | Second and third most common failure modes from GitHub signal mining. |
| Wed | Implement `role_boundary` and `output_schema` checkers | 2 | Round out the initial property library. |
| Wed | Multi-run execution: run scenario N times, report statistics | 2 | Critical for non-determinism handling. "Passed 4/5 runs" is more honest than "Passed" based on 1 lucky run. |
| Thu | pytest plugin: discover .yaml scenarios as test cases, report results in pytest format | 3 | This is the "fits into your existing workflow" moment. Once this works, Riftcheck is just another test in your CI pipeline. |
| Fri | Fault injection: implement `corrupt_message`, `add_latency`, `drop_message` | 2 | Adversarial testing is where Riftcheck goes beyond "just run your agents." |

**Week 2 deliverable:** Write a scenario with a deliberate information leak → `pytest` catches it → developer sees exactly which turn leaked which data.

### Week 3: Framework Adapters + Examples (15 hrs)

**Goal:** By Friday, a CrewAI user and a LangGraph user can each test their agents with Riftcheck without modifying their agent code.

| Day | Task | Hours | Why this order |
|---|---|---|---|
| Mon | CrewAI adapter: wrap a CrewAI Crew as AgentUnderTest | 4 | CrewAI is the most popular multi-agent framework. If we don't support it, we miss the biggest user base. |
| Tue | LangGraph adapter: wrap a LangGraph graph as AgentUnderTest | 4 | Second most popular. LangGraph's graph-based model is architecturally different from CrewAI's role-based model — the adapter needs to handle state differently. |
| Wed | Write 3 complete example projects with scenarios | 4 | Examples are documentation. A developer should be able to clone an example, run it, and understand how Riftcheck works in 10 minutes. |
| Thu-Fri | JSON trace output (.jsonl) + trace analysis utilities | 3 | Enable programmatic analysis of test results. The .jsonl format is the foundation for the future web viewer. |

**Example projects:**
1. **Negotiation** (2 agents, buyer/seller, test for info leaks and convergence)
2. **Research team** (3 agents, researcher/writer/reviewer, test for role boundaries and deadlocks)
3. **Customer support escalation** (3 agents, triage/specialist/supervisor, test for correct routing and no infinite escalation loops)

*Why these three:* They cover the three most common multi-agent patterns — bilateral negotiation, collaborative pipeline, and hierarchical delegation. A developer can find the example closest to their architecture and adapt it.

### Week 4: Polish, Docs, Launch (10 hrs)

**Goal:** By Friday, ship v0.1.0 to PyPI and post Show HN.

| Day | Task | Hours | Why this order |
|---|---|---|---|
| Mon | README: problem statement, 60-second quickstart, example output | 3 | The README is the landing page. If it doesn't hook a developer in 30 seconds, they leave. |
| Tue | Documentation: installation, writing scenarios, writing adapters, property reference | 3 | Docs are the product for developer tools. No docs = no users. |
| Wed | GitHub Actions workflow: reusable action for CI/CD | 1 | "Add multi-agent testing to your CI in 3 lines" is a powerful adoption hook. |
| Wed | Package and publish to PyPI | 1 | `pip install riftcheck` must work. |
| Thu | Write Show HN post + tweet thread | 1 | Launch content. The Show HN post should tell the story: "I kept hitting coordination bugs in multi-agent systems. Existing tools test individual agents. Nothing tests the interactions. So I built Riftcheck." |
| Fri | Launch: Show HN, tweet, post in CrewAI/LangGraph communities | 1 | Ship day. |

**Week 4 deliverable:** v0.1.0 live on PyPI, Show HN posted, README that makes a developer go "oh, I need this."

---

## 6. What Success Looks Like

### Week 1 milestone (internal)
"I can run two agents in a simulation and see their conversation in my terminal."

### Week 4 milestone (launch)
"A CrewAI or LangGraph developer can `pip install riftcheck`, write a YAML scenario in 5 minutes, and catch a multi-agent coordination bug they didn't know they had."

### Month 2 milestone (traction)
- 200+ GitHub stars
- 10+ issues filed by external users (means people are actually using it)
- 3+ blog posts or tweets by other developers mentioning Riftcheck

### Month 6 milestone (commercial readiness)
- 1,000+ GitHub stars
- Active Discord/Slack community
- Clear signal on what features people would pay for (web viewer, hosted CI, team features)
- Ready to build the commercial layer

---

## 7. Project Structure

```
riftcheck/
├── README.md
├── pyproject.toml
├── LICENSE (MIT)
├── src/
│   └── riftcheck/
│       ├── __init__.py
│       ├── cli.py              # CLI entry point
│       ├── engine.py           # Simulation engine
│       ├── scenario.py         # YAML scenario loader
│       ├── agent.py            # AgentUnderTest base class
│       ├── trace.py            # Trace recording + output
│       ├── properties/
│       │   ├── __init__.py
│       │   ├── information_leak.py
│       │   ├── convergence.py
│       │   ├── deadlock.py
│       │   ├── role_boundary.py
│       │   └── output_schema.py
│       ├── adapters/
│       │   ├── __init__.py
│       │   ├── raw.py          # Raw Python callable adapter
│       │   ├── crewai.py       # CrewAI adapter
│       │   └── langgraph.py    # LangGraph adapter
│       ├── faults/
│       │   ├── __init__.py
│       │   ├── corrupt.py
│       │   ├── latency.py
│       │   └── drop.py
│       └── pytest_plugin.py    # pytest integration
├── examples/
│   ├── negotiation/
│   ├── research_team/
│   └── support_escalation/
├── docs/
│   ├── quickstart.md
│   ├── scenarios.md
│   ├── properties.md
│   └── adapters.md
└── tests/
    └── ... (our own tests for riftcheck itself)
```

*Why this structure:* Flat enough to navigate at a glance, but organized by concern. A contributor can find where to add a new property checker (properties/), a new adapter (adapters/), or a new fault injector (faults/) without reading the whole codebase. The `src/` layout follows modern Python packaging best practices.

---

## 8. Research Foundations — What Academia Tells Us

Riftcheck is not built on intuition. Every architectural decision and property checker is cross-referenced against peer-reviewed research. This section documents what we learned and how it shaped the product.

### 8.1 Key Papers

| Paper | Venue | Key Contribution | License |
|---|---|---|---|
| **MAST** — "Why Do Multi-Agent LLM Systems Fail?" | NeurIPS 2025 (UC Berkeley) | First empirically-derived failure taxonomy: 14 failure modes across 3 categories, from 1,600+ annotated traces across 7 MAS frameworks | Open source |
| **MAESTRO** — Multi-Agent Evaluation Suite | arXiv Jan 2026 (SANDS Lab) | Statistical methodology for MAS evaluation: ≥20 runs, Jaccard/LCS similarity metrics, cost-latency-accuracy tradeoffs | CC BY 4.0 |
| **MARBLE / MultiAgentBench** | ACL 2025 Main (UIUC) | Benchmark across communication topologies (star, chain, tree, graph) with milestone-based KPIs | Open source |
| **MASEval** | parameterlab | Framework-agnostic evaluation interface; found framework choice matters as much as model choice | MIT |
| **AgentBench** | ICLR 2024 (THUDM) | First systematic benchmark of LLMs-as-agents across 8 environments | Apache 2.0 |

All methodologies and ideas are freely usable (scientific ideas are not copyrightable). All code repos use permissive licenses. We cite these papers in our docs for credibility, not legal obligation.

### 8.2 MAST Failure Taxonomy — Cross-Reference Against Riftcheck v0.1

MAST analyzed 150+ multi-agent execution traces (averaging 15,000+ lines each) with 6 expert annotators (Cohen's kappa = 0.88) and identified 14 failure modes in 3 categories. Here is how our v0.1 property checkers map to them:

**Category FC-1: Specification and System Design (41.8% of all failures)**

| ID | Failure Mode | Frequency | Riftcheck v0.1 Coverage |
|---|---|---|---|
| FM-1.1 | Disobey task specification | 15.7% | **Partial** — `output_schema` catches structural violations, but most task specs are richer than JSON schema |
| FM-1.2 | Disobey role specification | 1.5% | **Covered** — `role_boundary` |
| FM-1.3 | Step repetition | 13.2% | **Partial** — `converges_within` catches the symptom (timeout) but not the specific cause (repetition vs. genuine non-convergence) |
| FM-1.4 | Loss of conversation history | 8.2% | **Gap** |
| FM-1.5 | Unaware of termination conditions | 6.2% | **Partial** — `converges_within` catches timeout but not the root cause |

**Category FC-2: Inter-Agent Misalignment (36.9% of all failures)**

| ID | Failure Mode | Frequency | Riftcheck v0.1 Coverage |
|---|---|---|---|
| FM-2.1 | Conversation reset | 9.1% | **Gap** |
| FM-2.2 | Fail to ask for clarification | 1.9% | **Gap** |
| FM-2.3 | Task derailment | 2.8% | **Gap** |
| FM-2.4 | Information withholding | 12.4% | **Gap** — inverse of `no_information_leak`; agents not sharing data they *should* share |
| FM-2.5 | Ignored other agent's input | 0.8% | **Gap** |
| FM-2.6 | Reasoning-action mismatch | 6.8% | **Gap** |

**Category FC-3: Task Verification and Termination (21.3% of all failures)**

| ID | Failure Mode | Frequency | Riftcheck v0.1 Coverage |
|---|---|---|---|
| FM-3.1 | Premature termination | 7.4% | **Gap** |
| FM-3.2 | No or incomplete verification | 11.8% | **Covered** — `output_schema` |
| FM-3.3 | Incorrect verification | 2.2% | **Covered** — `output_schema` detects when declared output doesn't match actual output |

**Coverage summary:** 3 covered, 3 partially covered, 8 gaps. Our v0.1 checkers address ~25% of failure frequency directly, ~20% partially. The remaining ~55% maps directly to the v0.2-v0.4 property checker roadmap (see `product/roadmap.md`).

**What we cover that MAST doesn't:** `no_information_leak` (agents sharing data they shouldn't) and `no_deadlock` (mutual blocking) are not in MAST's taxonomy — likely because MAST focused on functional correctness, not security or liveness. These are real production concerns from our GitHub signal mining that the academic taxonomy missed. This is a differentiator.

### 8.3 Methodology Insights from MAESTRO

MAESTRO's key finding: multi-agent systems are "structurally stable but temporally variable." The *set* of agent interactions stays consistent across runs (Jaccard similarity: 0.86), but the *sequence* of interactions varies significantly (LCS similarity: 0.65). This has three implications for Riftcheck:

1. **Multi-run testing is non-negotiable.** MAESTRO used ≥20 runs. Our default of 5 is a cost compromise. We add a `--thorough` flag for 20 runs aligned with MAESTRO's methodology.

2. **Architecture matters more than model choice.** MAESTRO found that swapping to a more capable LLM does not reliably improve multi-agent performance — execution dynamics dominate. This validates our positioning: the problem isn't smarter models, it's better testing of how agents interact.

3. **Cost-latency-accuracy tradeoffs are essential.** MAESTRO found task-specific MAS designs are 10x cheaper and 2x faster than general-purpose architectures at comparable accuracy. Our trace output should capture cost and latency per agent per turn, not just correctness.

### 8.4 Topology Insights from MARBLE

MARBLE tested four communication topologies and found:

- **Graph/mesh** performed best overall (highest task scores, lowest token usage)
- **Star** (central coordinator) performed similarly but with a bottleneck
- **Tree** (hierarchical) performed worst — highest token consumption, lowest scores
- **Chain** (sequential) was limited by its serial nature

Implication for Riftcheck: our example scenarios should cover all four topologies, not just bilateral negotiation. The v0.1 examples already span negotiation (star/bilateral), research team (chain/pipeline), and support escalation (tree/hierarchical). We should add a graph/mesh example in v0.2.

MARBLE also found that agents can succeed at tasks while communicating poorly — a "fragile success" that breaks under slightly different conditions. This argues for measuring communication quality as a separate dimension from task completion, informing a v0.2 property checker.

---

## 9. Open Questions (To Resolve During Build)

1. **Should scenarios support async agent interactions?** Some multi-agent systems don't use turn-taking — agents fire messages whenever they want. v0.1 starts with synchronous turn-based simulation for simplicity, but async support may be needed for LangGraph's free-form graphs.

2. **How do we handle agents that call external tools?** If Agent A calls a database during simulation, should we mock it? Let it through? v0.1 answer: let the developer decide via adapter configuration. Provide a mock toolkit for common patterns.

3. **What's the right default for number of runs?** MAESTRO used ≥20 runs and found substantial variance even at that count. Our default of 5 is a cost compromise for development iteration. We ship a `--thorough` flag that runs 20 times for pre-deployment validation. For expensive agents (Opus-class), we also support `--runs 3` with a warning about statistical significance.

4. **Naming: `riftcheck` or `agent-qa` or `agenttester`?** Need to check PyPI availability before committing. `riftcheck` is clean and memorable.
