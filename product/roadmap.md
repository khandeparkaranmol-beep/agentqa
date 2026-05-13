# Riftcheck — Product Roadmap

*Every feature is justified by research data, GitHub signal mining, or first-principles reasoning. Nothing is here because it "seems nice to have."*

---

## Roadmap Philosophy

Three principles govern what ships when:

1. **Failure frequency dictates priority.** The MAST taxonomy (NeurIPS 2025) quantified 14 multi-agent failure modes with exact frequencies. Property checkers ship in order of how often the failure mode occurs in production, not in order of how interesting they are to build.

2. **Each version must be independently useful.** v0.1 is a complete product, not a stepping stone. A developer who never upgrades past v0.1 still gets value. Each subsequent version expands coverage but doesn't break what came before.

3. **Open source first, commercial layer later.** The roadmap has a clear inflection point at v0.5 where the commercial product begins to diverge from the open-source core. Before that point, everything is MIT-licensed and community-driven.

---

## Version Overview

| Version | Codename | Timeline | Theme | MAST Coverage |
|---|---|---|---|---|
| **v0.1** | First Light | Weeks 1-4 | Core engine + 5 property checkers | 25% direct, 20% partial |
| **v0.2** | Deep Scan | Weeks 5-8 | Information flow + state tracking checkers | +20% (cumulative ~65%) |
| **v0.3** | Adversarial | Weeks 9-12 | Reasoning validation + advanced fault injection | +15% (cumulative ~80%) |
| **v0.4** | Full Spectrum | Weeks 13-16 | Task completion + termination checkers | +15% (cumulative ~95%) |
| **v0.5** | Looking Glass | Months 5-6 | Web trace viewer + visual replay | 95% (presentation layer) |
| **v1.0** | Commercial | Months 7-12 | Hosted CI, team features, SaaS layer | 95%+ (monetization layer) |

---

## v0.1 — First Light (Weeks 1-4)

**Theme:** A developer can test multi-agent interactions from their terminal.

**Why this scope:** The smallest thing that delivers value nobody else offers. Every existing tool (LangSmith, Maxim, LangWatch) tests individual agents. Riftcheck v0.1 is the first tool that tests agent-to-agent interactions. That's the wedge.

### Features

| Feature | What It Does | Why It's Here |
|---|---|---|
| Agent adapter layer | `AgentUnderTest` base class with `receive()` + `get_state()` contract | Without it, nothing works. Thinnest possible wrapper to support any framework. |
| Scenario DSL | YAML-based declarative test scenarios | Makes test writing accessible. Diffable in git. Non-engineers can read them. |
| Simulation engine | Orchestrates agents, manages turns, injects faults, records traces | The core product. Everything else is built around it. |
| Property checkers (5) | `no_information_leak`, `converges_within`, `no_deadlock`, `role_boundary`, `output_schema` | Covers the most common production bugs from GitHub signal mining. |
| CLI + pytest plugin | `riftcheck run` + pytest test discovery | Zero-friction integration into existing developer workflow. |
| Trace output | JSONL machine-readable + human-readable terminal output | Developers need to SEE what went wrong. |

### MAST Coverage

| Checker | MAST Failure Modes Addressed | Combined Frequency |
|---|---|---|
| `no_information_leak` | Not in MAST (security concern, from GitHub signals) | N/A — unique to Riftcheck |
| `converges_within` | FM-1.3 Step repetition (partial), FM-1.5 Unaware of termination (partial) | 19.4% partial |
| `no_deadlock` | Not in MAST (liveness concern, from GitHub signals) | N/A — unique to Riftcheck |
| `role_boundary` | FM-1.2 Disobey role specification | 1.5% direct |
| `output_schema` | FM-1.1 Disobey task spec (partial), FM-3.2 Incomplete verification, FM-3.3 Incorrect verification | 29.7% (14% partial, 15.7% direct) |

### Adapters

| Framework | Priority | Reason |
|---|---|---|
| Raw Python callable | Week 1 | No dependencies. Works for anyone. |
| CrewAI | Week 3 | Most popular multi-agent framework. |
| LangGraph | Week 3 | Second most popular. Different architecture (graph-based vs role-based). |

### Success Criteria
- A CrewAI or LangGraph developer can `pip install riftcheck`, write a YAML scenario in 5 minutes, and catch a coordination bug they didn't know they had.

---

## v0.2 — Deep Scan (Weeks 5-8)

**Theme:** Catch information flow failures — the #3 most common multi-agent failure mode.

**Why now:** MAST's FM-2.4 (information withholding, 12.4%) and FM-1.4 (loss of conversation history, 8.2%) are the highest-frequency gaps after v0.1. These are inter-agent communication failures — exactly the category Riftcheck is built to detect.

### New Property Checkers

| Checker | MAST Failure Mode | Frequency | What It Does | How It Works |
|---|---|---|---|---|
| `ensures_information_flow` | FM-2.4 Information withholding (12.4%) | 12.4% | Verifies that Agent A shares specific data with Agent B when it should | Developer declares required information flows in scenario YAML. Checker scans trace for whether the data actually moved from source to destination. |
| `state_continuity` | FM-1.4 Loss of conversation history (8.2%) | 8.2% | Detects when an agent's behavior suggests it has "forgotten" prior context | Tracks information each agent should know (all messages received) and flags when agent responses contradict or ignore that information. Uses embedding similarity between agent state snapshots across turns. |
| `no_conversation_reset` | FM-2.1 Conversation reset (9.1%) | 9.1% | Detects when accumulated state is unexpectedly lost | Monitors state similarity across turns. If an agent's state suddenly becomes more similar to its *initial* state than its *previous* state, flags a reset. |

**Why these three:** They address 29.7% of all MAST failures and are the three highest-frequency gaps remaining after v0.1. All three are information-flow problems — a natural cluster to build together because they share underlying trace analysis infrastructure (state tracking, message provenance, similarity computation).

### Other v0.2 Features

| Feature | Why |
|---|---|
| **Web trace viewer** | Visual replay of multi-agent interactions. This is the "product magic" moment — seeing agents talk to each other in a timeline view. Transforms debugging from reading logs to watching a conversation. |
| **LLM-powered scenario generation** | "Generate 10 adversarial scenarios for my procurement negotiation system." Reduces the cold-start problem. Uses the developer's agent descriptions to produce relevant edge cases. |
| **Graph/mesh example scenario** | MARBLE found graph topologies perform best but fail differently than star/chain/tree. Need an example covering this topology. |
| **Cost tracking per run** | MAESTRO showed cost-latency-accuracy tradeoffs are essential. Each trace records token count and estimated cost per agent per turn. |
| **`--thorough` flag** | Runs scenario 20 times, aligned with MAESTRO's methodology. Default remains 5 for iteration speed. |

### Adapters

| Framework | Priority | Reason |
|---|---|---|
| AutoGen | High | Third most popular multi-agent framework. Microsoft-backed. |
| A2A Protocol | Medium | Google's Agent-to-Agent protocol (Linux Foundation, 150+ orgs). Future-facing. |

### Success Criteria
- v0.2 covers ~65% of MAST failure frequency.
- The web trace viewer generates "oh wow" moments when developers see their agents' interactions visualized.
- At least one community-contributed property checker or adapter submitted via PR.

---

## v0.3 — Adversarial (Weeks 9-12)

**Theme:** Catch agents that say one thing and do another, and agents that go off-script.

**Why now:** FM-2.6 (reasoning-action mismatch, 6.8%) and FM-2.3 (task derailment, 2.8%) require deeper trace analysis — comparing agent reasoning (chain-of-thought) against agent actions. This is technically harder than information-flow checks and builds on the trace infrastructure from v0.2.

### New Property Checkers

| Checker | MAST Failure Mode | Frequency | What It Does | How It Works |
|---|---|---|---|---|
| `reasoning_action_consistency` | FM-2.6 Reasoning-action mismatch (6.8%) | 6.8% | Detects when an agent's chain-of-thought reasoning doesn't match its actual actions | Compares the intent expressed in agent reasoning traces against the action taken. Flags cases where the agent "says one thing and does another." Requires agents to expose reasoning (most LLM agents do via chain-of-thought). |
| `stays_on_task` | FM-2.3 Task derailment (2.8%) | 2.8% | Detects when an agent veers off its assigned objective | Tracks semantic similarity between agent actions and the task objective defined in the scenario. Flags when actions drift beyond a configurable threshold. |
| `respects_peer_input` | FM-2.5 Ignored other agent's input (0.8%) | 0.8% | Detects when an agent disregards corrections or information from another agent | Tracks messages received vs. subsequent behavior changes. If Agent B tells Agent A to correct something and Agent A's next action ignores it, flags a violation. |
| `step_repetition_detector` | FM-1.3 Step repetition (upgrade from partial) | 13.2% | Specifically identifies repeated steps vs. genuine non-convergence | Upgrades `converges_within` from partial to full coverage of FM-1.3. Uses message fingerprinting to detect when an agent sends structurally identical messages across turns, distinguishing repetition loops from slow-but-progressing negotiation. |

### Other v0.3 Features

| Feature | Why |
|---|---|
| **Advanced fault injection** | Adversarial scenarios: inject contradictory instructions, simulate agent hallucinations, inject delays that trigger timeout-sensitive coordination bugs. Informed by MAST's finding that many failures are triggered by environmental stress. |
| **Snapshot & replay** | Save a production interaction trace, replay it locally. Reduces the "it works on my machine" problem for multi-agent debugging. |
| **Communication quality score** | MARBLE found agents can succeed at tasks while communicating poorly (fragile success). Score communication efficiency as a separate dimension: message relevance, information density, redundancy. |

### Success Criteria
- v0.3 covers ~80% of MAST failure frequency.
- `step_repetition_detector` upgrades the most common partial coverage (FM-1.3, 13.2%) to full coverage.
- Community has contributed at least 2 adapters or property checkers.

---

## v0.4 — Full Spectrum (Weeks 13-16)

**Theme:** Catch premature exits and verification failures — the "looks done but isn't" category.

**Why now:** FC-3 (task verification and termination, 21.3% of failures) is the category where agents declare victory prematurely or verify incorrectly. These are the most insidious failures because the system *reports success* while the task objective hasn't been met. They require task-level understanding, not just interaction-level analysis.

### New Property Checkers

| Checker | MAST Failure Mode | Frequency | What It Does |
|---|---|---|---|
| `no_premature_termination` | FM-3.1 Premature termination (7.4%) | 7.4% | Verifies that agents complete all required milestones before declaring success. Developer defines completion criteria in the scenario; checker ensures all were met before the final "done" signal. |
| `asks_for_clarification` | FM-2.2 Fail to ask for clarification (1.9%) | 1.9% | In scenarios with deliberately ambiguous instructions, verifies that agents request clarification rather than proceeding with assumptions. |
| `task_specification_compliance` | FM-1.1 Disobey task specification (upgrade from partial) | 15.7% | Upgrades `output_schema` from partial to fuller coverage. Uses LLM-as-judge (following MAST's validated approach) to evaluate whether agent behavior complies with natural-language task specifications, not just structural JSON schemas. |

### Other v0.4 Features

| Feature | Why |
|---|---|
| **Milestone-based metrics** | Inspired by MARBLE's KPI system. Track intermediate progress, not just final outcome. "Agent A completed 3/5 milestones before deadlocking" is more useful than "test failed." |
| **Topology-aware reporting** | Report results grouped by communication topology (star, chain, tree, graph). Automatically classifies the scenario's topology from the interaction trace. |
| **MAST-compatible trace export** | Export traces in a format compatible with MAST's annotation pipeline. Lets teams who already use MAST's tools analyze Riftcheck traces without conversion. |

### Success Criteria
- v0.4 covers ~95% of MAST failure frequency.
- FM-1.1 (the single most common failure at 15.7%) upgraded from partial to substantive coverage.
- Riftcheck is the most comprehensive multi-agent testing tool available, open-source or commercial.

---

## v0.5 — Looking Glass (Months 5-6)

**Theme:** Make multi-agent interactions visible and beautiful.

**Why now:** By v0.4, the *detection* layer is comprehensive. But detection without understanding is frustrating. The web viewer transforms Riftcheck from a CLI tool into an experience — developers can *see* their agents interact, *replay* failures frame by frame, and *share* traces with teammates.

### Features

| Feature | What It Does |
|---|---|
| **Interactive trace viewer** | Web-based timeline view of multi-agent interactions. Each agent is a swimlane. Messages are arrows. State changes are annotated. Property violations are highlighted in red with exact turn/message. |
| **Trace diffing** | Compare two traces side-by-side. "What changed between the passing run and the failing run?" This is the multi-agent equivalent of `git diff` for debugging. |
| **Shareable trace links** | Generate a static HTML file from any trace that can be shared via URL, Slack, or embedded in a GitHub issue. No server required. |
| **Dashboard** | Aggregate view across all scenarios: pass rates over time, flakiness trends, most common failure modes, cost per test suite. |

### Why This Is the Open-Source / Commercial Inflection Point

v0.5 is the last version that's purely open-source. The trace viewer, diffing, and dashboard are compelling standalone tools. But they also create the natural upgrade path:

- "I want to share traces with my team" → team features (v1.0)
- "I want to run this in CI without managing infrastructure" → hosted CI (v1.0)
- "I want historical trends across deploys" → persistence + analytics (v1.0)

The open-source version ships everything above as a local tool. The commercial version adds multi-user, hosted, and historical capabilities on top.

---

## v1.0 — Commercial (Months 7-12)

**Theme:** The commercial product that generates revenue.

**Why now:** By v0.5, the open-source tool has (target) 1,000+ stars, an active community, and developers who've integrated Riftcheck into their CI pipelines. The commercial layer adds what teams need but individuals don't: collaboration, hosting, and persistence.

### Commercial Features (Not in Open Source)

| Feature | Pricing Signal | Why Teams Pay |
|---|---|---|
| **Hosted CI runner** | Core monetization | "Run your Riftcheck suite in our cloud. No GPU provisioning, no API key management, no infrastructure." Teams pay to not deal with infra. |
| **Team trace sharing** | Collaboration premium | Traces are shared across the team with role-based access. Comments, annotations, and assignments on specific failures. |
| **Historical analytics** | Retention hook | Track property violation rates across deploys. "Your information leak rate dropped from 12% to 2% over the last 3 months." Trend data creates switching costs. |
| **Alerting + notifications** | Ops integration | Slack/email alerts when a property violation rate exceeds a threshold. Integrates with PagerDuty/Opsgenie for on-call workflows. |
| **Custom property checker marketplace** | Ecosystem play | Community-contributed property checkers with optional paid tiers for enterprise-grade checkers (SOC2 compliance, HIPAA data flow, etc.). |

### Pricing Model (Preliminary)

Based on developer interview WTP signals and competitive analysis:

| Tier | Price | Target | What's Included |
|---|---|---|---|
| **Open Source** | Free forever | Individual developers | CLI, all property checkers, local trace viewer, unlimited local runs |
| **Team** | $49/seat/month | Small teams (5-20) | Hosted CI, team sharing, 1,000 cloud runs/month, 30-day history |
| **Enterprise** | $199/seat/month | Mid-market (20-500) | Unlimited cloud runs, 1-year history, SSO, custom checkers, SLA |

*Why these prices:* Developer interview Q9 asks about hours/week spent debugging coordination issues. At 5 hrs/week × $75/hr = $1,500/month of pain. $49/seat is a no-brainer if the tool saves even 2 hours/month. $199/seat is justified for enterprises where a single multi-agent production incident costs thousands in engineer-hours.

---

## Property Checker Roadmap — Complete MAST Coverage

This table shows the full roadmap for covering all 14 MAST failure modes, ordered by version:

| Version | Checker | MAST FM | Frequency | Type |
|---|---|---|---|---|
| **v0.1** | `no_information_leak` | — (not in MAST) | — | Riftcheck original |
| **v0.1** | `no_deadlock` | — (not in MAST) | — | Riftcheck original |
| **v0.1** | `role_boundary` | FM-1.2 | 1.5% | Direct match |
| **v0.1** | `output_schema` | FM-1.1 (partial), FM-3.2, FM-3.3 | 29.7% | Partial + direct |
| **v0.1** | `converges_within` | FM-1.3 (partial), FM-1.5 (partial) | 19.4% | Partial |
| **v0.2** | `ensures_information_flow` | FM-2.4 | 12.4% | Direct match |
| **v0.2** | `state_continuity` | FM-1.4 | 8.2% | Direct match |
| **v0.2** | `no_conversation_reset` | FM-2.1 | 9.1% | Direct match |
| **v0.3** | `reasoning_action_consistency` | FM-2.6 | 6.8% | Direct match |
| **v0.3** | `stays_on_task` | FM-2.3 | 2.8% | Direct match |
| **v0.3** | `respects_peer_input` | FM-2.5 | 0.8% | Direct match |
| **v0.3** | `step_repetition_detector` | FM-1.3 (upgrade) | 13.2% | Upgrade to full |
| **v0.4** | `no_premature_termination` | FM-3.1 | 7.4% | Direct match |
| **v0.4** | `asks_for_clarification` | FM-2.2 | 1.9% | Direct match |
| **v0.4** | `task_specification_compliance` | FM-1.1 (upgrade) | 15.7% | Upgrade to full |

**By v0.4:** All 14 MAST failure modes have dedicated property checkers. Plus 2 original Riftcheck checkers (`no_information_leak`, `no_deadlock`) that cover failure modes the academic taxonomy missed.

---

## Methodology Roadmap — Research-Informed Capabilities

Beyond property checkers, these capabilities are drawn directly from academic research:

| Version | Capability | Source | What It Adds |
|---|---|---|---|
| **v0.1** | Multi-run statistical testing (default 5) | MAESTRO | Honest results instead of lucky single-run pass |
| **v0.2** | `--thorough` flag (20 runs) | MAESTRO | Production-grade statistical confidence |
| **v0.2** | Cost tracking per agent per turn | MAESTRO | Cost-latency-accuracy tradeoff visibility |
| **v0.3** | Communication quality score | MARBLE | Fragile-success detection (task passes but communication is poor) |
| **v0.3** | LLM-as-judge for natural-language assertions | MAST | Validated approach for evaluating subjective compliance |
| **v0.4** | Milestone-based KPIs | MARBLE | Intermediate progress tracking, not just final pass/fail |
| **v0.4** | Topology-aware reporting | MARBLE | Results grouped by communication pattern |
| **v0.4** | MAST-compatible trace export | MAST | Interoperability with academic tools |
| **v0.5** | Jaccard/LCS structural similarity metrics | MAESTRO | Quantify how stable your system's interaction patterns are across runs |

---

## Adapter Roadmap

| Version | Adapter | Framework | Reason |
|---|---|---|---|
| **v0.1** | `raw` | Raw Python callable | Universal fallback. No dependencies. |
| **v0.1** | `crewai` | CrewAI | Most popular multi-agent framework |
| **v0.1** | `langgraph` | LangGraph | Second most popular. Graph-based architecture. |
| **v0.2** | `autogen` | AutoGen (AG2) | Third most popular. Microsoft-backed. |
| **v0.2** | `a2a` | A2A Protocol | Google's agent-to-agent standard. 150+ orgs. Future of agent interop. |
| **v0.3** | `openai_swarm` | OpenAI Swarm | Growing adoption for lightweight multi-agent setups. |
| **v0.3** | `magentic_one` | Magentic-One | Microsoft's multi-agent orchestration. |
| **v0.4+** | Community-contributed | Any framework | Open adapter API. Community submits PRs. |

---

## Timeline vs. Reality

This roadmap assumes 15-20 hours/week alongside job hunting. Reality will shift things. The principles for adapting:

1. **v0.1 is non-negotiable.** Ship it in 4 weeks or learn why you can't (which is also valuable).
2. **v0.2-v0.4 are guided by community feedback.** If users scream for `ensures_information_flow` before `reasoning_action_consistency`, swap the order. MAST frequencies are defaults, not commandments.
3. **v0.5 timing depends on traction.** If the open-source tool gets <200 stars by month 4, reconsider the commercial path. If it gets >500, accelerate v0.5.
4. **v1.0 only happens with signal.** Don't build the commercial layer until ≥5 teams are using Riftcheck in CI and asking for features that require a hosted service.

---

## Citations

This roadmap is informed by the following research. Riftcheck cites these in its documentation for credibility and academic goodwill.

1. Cemri, Pan, Yang et al. "Why Do Multi-Agent LLM Systems Fail?" NeurIPS 2025. arXiv:2503.13657. — Failure taxonomy (14 modes, 3 categories)
2. Ma, Chen, Anand et al. "MAESTRO: Multi-Agent Evaluation Suite for Testing, Reliability, and Observability." arXiv:2601.00481. — Statistical evaluation methodology
3. MARBLE / MultiAgentBench. ACL 2025 Main. arXiv:2503.01935. — Communication topology benchmarking
4. MASEval (parameterlab). arXiv:2603.08835. — Framework-agnostic evaluation interface
5. AgentBench (THUDM). ICLR 2024. arXiv:2308.03688. — LLM-as-agent benchmarking
