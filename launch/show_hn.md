# Show HN Post — AgentQA v0.7

## Research Applied

Key learnings from Hacker News research (2025-2026):
- **Title**: Use digits, version numbers, or concrete claims. "Show HN: I cut X by Y%" outperforms vague titles
- **First 30 minutes** decide everything — need 8-10 upvotes + 2-3 thoughtful comments to reach top 10
- **Tone**: Talk like a fellow builder having a drink, not a marketer writing copy
- **GitHub link** in the post body is expected — signals real, working tool
- **Depth > breadth**: HN rewards "I couldn't find this anywhere else" insight
- **No marketing language**: "excited to announce", "game-changing", "disrupting" = instant downvotes
- **Code snippets** and concrete examples get engagement
- **Open source, privacy-first** framing resonates strongly
- **Live demo** with zero setup = strongest conversion
- **Answer every comment** in first 2 hours, go deep on technical questions

---

## Iteration 1 (baseline cleanup)
_Changes: Tightened the opening. Removed "Hi HN" pleasantry (it's fine but wasting first-line real estate). Made the title more specific._

### Title
Show HN: AgentQA – Property-based testing for multi-agent AI systems

### Body

I built AgentQA because I kept hitting bugs in multi-agent systems that no single-agent test catches — information leaking between agents, deadlocks, agents looping the same response, tasks marked done before completion. These only surface when agents interact.

```bash
pip install agentqa
agentqa init .
agentqa run scenario.yaml --view
```

`agentqa init` AST-scans your Python project (no LLM), detects agents from CrewAI, LangGraph, AutoGen, or plain callables, and generates a scenario.yaml + agents.py with fault injection and property assertions.

It runs scenarios N times and reports pass rates with Wilson score confidence intervals. 4/5 passing with CI [36%–97%] tells you to run more iterations; 18/20 passing with CI [75%–97%] is something you can trust.

16 property checkers covering information leaks, deadlocks, role boundary violations, step repetition, convergence failures, premature termination, and more. Aligned with the MAST failure taxonomy (NeurIPS 2025).

Trace viewer is a single self-contained HTML file — three view modes (spotlight replay, constellation graph, swimlane timeline), per-property CI bars in the sidebar. No server, no account.

MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Live demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA
PyPI: https://pypi.org/project/agentqa/

Feedback I'd value: what properties would you want to check that aren't here yet?

---

## Iteration 2 (concrete title + technical depth)
_Changes: Title includes concrete numbers. Added the "what's different from just running pytest" preemptive answer. Showed a real CI example. Cut "aligned with MAST" to a parenthetical._

### Title
Show HN: AgentQA – 16 property checkers for multi-agent AI bugs (Python, MIT)

### Body

I built AgentQA to catch a class of bugs that pytest can't: the ones that only exist when AI agents talk to each other.

Example: Agent A has a private budget of $10K. Agent B has a floor price of $6.8K. They negotiate. If Agent A ever mentions "$10,000" where Agent B can see it, that's an information leak — and no amount of unit testing on either agent individually would catch it.

```bash
pip install agentqa
agentqa init .          # AST-scans your code, generates scenario + agents
agentqa run scenario.yaml --view   # runs N times, opens trace viewer
```

`agentqa init` detects agents from CrewAI, LangGraph, AutoGen, or plain Python functions. No LLM calls — it's pure AST scanning. It generates a scenario.yaml with fault injection (message corruption, hallucinations, contradictions, drops) and property assertions.

Every scenario runs N times (default 5, `--thorough` for 20). Results come with Wilson score confidence intervals:

```
no_information_leak    5/5 passed  100%  CI [57%–100%]
converges_within       4/5 passed   80%  CI [36%–97%]
  ↳ CI is wide — run with --runs 20 for a tighter estimate
```

16 property checkers total (MAST taxonomy, NeurIPS 2025): information leak, deadlock, role boundary, step repetition, convergence, premature termination, state continuity, conversation reset, task adherence, communication quality, peer input, clarification, reasoning-action consistency, task compliance, output schema, information flow.

The trace viewer exports to a single HTML file — no server. Three views: spotlight (cinematic step-through), constellation (agent network), timeline (swimlane). Live demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html

MIT licensed. ~2K lines of Python, no heavy dependencies (PyYAML, Click, Pydantic).

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What multi-agent failure modes am I missing?

---

## Iteration 3 (preemptive FAQ + builder tone)
_Changes: Addressed the "why not just use pytest" question directly. Added "how it works under the hood" section. More builder-to-builder tone. Trimmed the property list to what's interesting, not exhaustive._

### Title
Show HN: AgentQA – Test how your AI agents interact, not just how they work alone

### Body

Multi-agent bugs are a different animal. Your agent passes every unit test — then leaks another agent's private data mid-conversation, or deadlocks waiting for a response that never comes, or loops the same message forever.

I built AgentQA to catch these. It's a pytest-style framework, but instead of testing functions in isolation, it tests the conversation between agents.

```bash
pip install agentqa
agentqa init .
agentqa run scenario.yaml --view
```

**How it works under the hood:**

`agentqa init` AST-scans your Python code — no LLM calls. It detects agent classes/functions from CrewAI, LangGraph, AutoGen, or plain Python, extracts their roles and topology, and generates a scenario.yaml with fault injection and property assertions.

The engine owns the event loop. Agents never call each other directly — all communication routes through the engine, which records every message, applies faults at specified turns (corruption, contradictions, hallucinations, message drops), and runs property checks against the complete trace.

Every scenario runs N times. Results use Wilson score confidence intervals so you can tell whether 4/5 passing is meaningful or noise.

**16 property checkers** — the interesting ones:
- `no_information_leak` — checks if private setup data (budgets, API keys) surfaces in other agents' messages
- `no_deadlock` — detects all-same loops and ping-pong alternation
- `reasoning_action_consistency` — catches "I will NOT share the data" immediately followed by sharing the data
- `no_conversation_reset` — state fingerprinting to detect agent amnesia

Full list + what each catches: https://khandeparkaranmol-beep.github.io/AgentQA/#properties

Trace viewer is a single HTML file with three views. No server. Live demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html

~2K lines of Python. MIT licensed. Dependencies: PyYAML, Click, Pydantic.

GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What interaction bugs have you hit that this wouldn't catch?

---

## Iteration 4 (concrete example-first)
_Changes: Led with a concrete failing test case, not abstract claims. Showed actual CLI output. Let the reader see themselves in the scenario. Moved architecture details to a "How" section after the hook._

### Title
Show HN: AgentQA – Catches bugs that only exist when AI agents talk to each other

### Body

Here's a test case: a buyer agent with a private budget of $10K negotiates with a seller who has a floor price of $6.8K. On turn 4, you inject a corrupted message. Does the buyer accidentally reveal its budget? Does either agent deadlock? Does the negotiation still converge?

That's what AgentQA tests. It simulates adversarial multi-agent interactions and checks properties against the full conversation trace.

```bash
pip install agentqa
agentqa init .          # AST-scans your code, generates test scenario
agentqa run scenario.yaml --view
```

Output:

```
Price negotiation (5 runs)
  no_information_leak    5/5  100%  CI [57%–100%]
  converges_within       4/5   80%  CI [36%–97%]
    ↳ CI is wide — run with --runs 20 for tighter estimate
  no_deadlock            5/5  100%  CI [57%–100%]
```

**How:** `agentqa init` does pure AST scanning (no LLM) on your CrewAI / LangGraph / AutoGen / plain Python code. It detects agent classes, extracts roles and topology, and generates a scenario.yaml with fault injection and property assertions. The engine routes all communication — agents never call each other directly. Faults intercept messages between send and receive.

**What it checks:** 16 property checkers covering information leaks, deadlocks, role violations, step repetition, convergence, premature termination, state continuity, agent amnesia, and more. Based on the MAST failure taxonomy (NeurIPS 2025).

**Trace viewer:** Single HTML file, no server. Three views: spotlight (step-through replay), constellation (agent graph), timeline (swimlane). Per-property CI bars in the sidebar.

~2K lines of Python. PyYAML + Click + Pydantic. MIT licensed.

Live demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What failure modes would you add?

---

## Iteration 5 — FINAL (best of all iterations)
_Changes: Combined concrete-example opening from #4, under-the-hood depth from #3, builder tone throughout. Removed anything that reads like a feature list or marketing. Every section answers a question the HN reader is already thinking. Title is clear + specific._

### Title
Show HN: AgentQA – Catches bugs that only exist when AI agents talk to each other

### Body

Here's the kind of bug this catches: a buyer agent has a private budget of $10K. A seller has a floor price of $6.8K. They negotiate. On turn 4, you inject a corrupted message. The buyer accidentally reveals its budget. Neither agent's unit tests would have caught that.

AgentQA tests the conversation between agents, not the agents themselves. It's a pytest-style framework for multi-agent interaction testing.

```bash
pip install agentqa
agentqa init .          # AST-scans your code, no LLM
agentqa run scenario.yaml --view
```

`agentqa init` detects agents from CrewAI, LangGraph, AutoGen, or plain Python functions using AST scanning. It generates a scenario.yaml with fault injection (corruption, contradictions, hallucinations, message drops) and property assertions — ready to run.

The engine owns the event loop: agents never call each other directly. All communication routes through the engine, which records every message, applies faults between send and receive, and checks properties against the complete trace.

Every scenario runs N times. Results use Wilson score confidence intervals:

```
no_information_leak    5/5  100%  CI [57%–100%]
converges_within       4/5   80%  CI [36%–97%]
  ↳ CI is wide — run with --runs 20 for tighter estimate
```

16 property checkers (MAST taxonomy, NeurIPS 2025). The interesting ones: `no_information_leak` checks if private data leaks across agents. `reasoning_action_consistency` catches "I won't share the data" immediately followed by sharing it. `no_conversation_reset` uses state fingerprinting to detect agent amnesia.

Trace viewer exports to a single HTML file — three views, per-property CI bars, no server. Live demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html

~2K lines of Python. Dependencies: PyYAML, Click, Pydantic. MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA
PyPI: https://pypi.org/project/agentqa/

What interaction failure modes am I missing?

---

## Posting notes

- Post Tuesday-Thursday, 8-10am ET (or Sunday midnight PT for lower competition)
- Don't edit the title after posting — HN penalizes edits
- Reply to every comment within 2 hours — go deep on technical questions
- If someone asks "why not just pytest" → explain: pytest tests functions, this tests conversations; the engine orchestrates all communication so faults can be injected between send/receive
- If someone asks about the research → MAST (NeurIPS 2025) identified 14 failure modes in multi-agent systems; AgentQA maps 16 property checkers to that taxonomy
- Don't mention Product Hunt, launches, or growth numbers
- Talk like a builder, not a marketer
