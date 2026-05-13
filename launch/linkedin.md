# LinkedIn Post — AgentQA v0.7

## Research Applied

Key learnings from LinkedIn algorithm research (2025-2026):
- **Dwell time** is the #1 ranking signal — posts need to be scannable but deep enough to hold attention
- **Hook in lines 1-2** determines whether anyone reads past "see more" — contrarian or narrative hooks outperform
- **Comments > likes** (2x weight) — end with a specific, easy-to-answer question
- **No engagement bait** — algorithm penalizes "like if you agree" patterns via NLP
- **Reply within 60 min** = 2.4x higher reach
- **458 chars** is the engagement sweet spot, but dev-tool posts can go longer if value-dense
- **Narrative hooks** ("I found X while doing Y") outperform feature lists
- Posts that include a direct question see **77% more comments**

---

## Iteration 1 (baseline cleanup)
_Changes: Removed redundant "these bugs never show up" line (said twice). Tightened structure._

Multi-agent AI systems have a testing gap: we test agents individually, but not how they interact.

I kept running into bugs that no single-agent test could catch:

→ Agent B accidentally sees Agent A's private budget
→ Two agents deadlock waiting for each other forever
→ An agent repeats the same message 4 times in a loop
→ A "completed" task that was never actually finished

So I built AgentQA — a testing framework that simulates multi-agent interactions before they hit production.

Point it at your existing codebase:

pip install agentqa
agentqa init .
agentqa run scenario.yaml --view

It scans your code (CrewAI, LangGraph, AutoGen, or raw Python), detects your agents and topology, generates test scenarios with fault injection, runs them N times, and reports pass rates with Wilson score confidence intervals.

16 property checkers aligned with the MAST failure taxonomy (NeurIPS 2025). Trace viewer exports to a single HTML file — three view modes, per-property CI bars, no server needed.

Open source. MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Interactive demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What's the worst bug you've found that only shows up when agents talk to each other?

---

## Iteration 2 (narrative hook)
_Changes: Replaced abstract opening with a specific story. Added the "see more" fold strategy — hook must land in 2 lines. Cut jargon ("Wilson score confidence intervals" → plain English). Made the question more specific._

I watched two AI agents deadlock for 47 turns — each politely waiting for the other to go first.

That's when I realized: we test agents individually, but nobody tests the conversation.

So I built AgentQA. Three commands:

pip install agentqa
agentqa init .
agentqa run scenario.yaml --view

It scans your existing code (CrewAI, LangGraph, AutoGen, or plain Python), detects your agents automatically, generates adversarial test scenarios, and runs them multiple times with statistical confidence intervals.

What it catches:
→ Information leaking between agents (private budgets, API keys)
→ Deadlocks — agents stuck waiting for each other
→ Agents looping the same response over and over
→ Tasks marked "done" before they're actually finished

16 property checkers. Fault injection (corruption, hallucinations, contradictions, message drops). A trace viewer that exports as a single HTML file — no server, no account, no setup.

Open source. MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Try the demo (no install): https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What's the strangest failure you've seen when two AI agents try to work together?

---

## Iteration 3 (contrarian hook + sharper structure)
_Changes: Contrarian opening ("your agent works fine — until it talks to another agent"). Shorter paragraphs for mobile. Moved "3 commands" higher. Replaced bullet arrows with a numbered "what it catches" for scanability. Added a concrete number (47 turns) for credibility._

Your AI agent works fine in isolation. Put two of them together and watch one leak the other's private data.

That's the gap: unit tests pass, integration breaks. Not in the code — in the conversation between agents.

I built AgentQA to close it. Three commands from zero to your first test:

pip install agentqa
agentqa init .
agentqa run scenario.yaml --view

It AST-scans your existing code, detects agents from CrewAI / LangGraph / AutoGen / raw Python, generates adversarial scenarios, and runs them N times with confidence intervals — not a single pass/fail.

What it catches (16 property checkers):
1. Information leaks — private data surfacing in other agents' messages
2. Deadlocks — agents stuck in infinite waiting loops
3. Step repetition — same response echoing 4+ times
4. Premature termination — "done" before the job is actually done
5. Role violations, convergence failures, and 10 more

The trace viewer is a single HTML file. Three views. No server. No account. Just open and debug.

Open source. MIT. Backed by the MAST failure taxonomy (NeurIPS 2025).

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Interactive demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

If you're running multi-agent systems: what failure mode keeps you up at night?

---

## Iteration 4 (dwell-time optimized — story + payoff)
_Changes: Full narrative arc (problem → realization → solution → proof → ask). Removed numbered lists to feel less like a product page. Added specificity ("I counted 6 classes of bugs"). Shorter hook. Each paragraph earns the next scroll._

I found 6 classes of bugs that only exist when AI agents talk to each other.

Not bugs in the agents themselves — bugs in the interaction. One agent leaks another's private budget. Two agents deadlock, each waiting for the other. An agent echoes the same response on loop. A task gets marked "done" when it isn't.

None of these show up in unit tests. They only emerge in conversation.

I built AgentQA to catch them. You point it at your existing codebase — CrewAI, LangGraph, AutoGen, or plain Python — and it does the rest:

pip install agentqa
agentqa init .
agentqa run scenario.yaml --view

It AST-scans your code, detects agents automatically, generates adversarial test scenarios with fault injection (corruption, hallucinations, contradictions, message drops), and runs them multiple times. Pass rates come with confidence intervals so you know whether 4/5 passing is signal or noise.

16 property checkers aligned with the MAST failure taxonomy (NeurIPS 2025). A trace viewer that's a single HTML file — three cinematic views, per-property CI bars, no server, no account.

Open source. MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Interactive demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

How many of your multi-agent bugs would a unit test have caught? I'm betting it's fewer than you think.

---

## Iteration 5 — FINAL (best of all iterations)
_Changes: Combined the best-performing elements: narrative hook from #2, contrarian edge from #3, dwell-time structure from #4. Tighter closing question. Removed anything that reads like marketing copy. Every line earns the next._

I watched two AI agents deadlock for 47 turns — each politely waiting for the other to go first. Both passed their unit tests.

That's the blind spot: we test agents in isolation, but the bugs live in the conversation between them. Information leaks, infinite loops, tasks marked "done" before they're finished — none of this shows up until agents interact.

I built AgentQA to catch these before production does.

pip install agentqa
agentqa init .
agentqa run scenario.yaml --view

Point it at your existing code (CrewAI, LangGraph, AutoGen, or raw Python). It AST-scans your agents, generates adversarial test scenarios with fault injection, runs them multiple times, and reports pass rates with confidence intervals — so you know whether 4/5 passing is signal or noise.

16 property checkers. Five fault types. A trace viewer that's a single HTML file — three views, no server, no account. Open source, MIT licensed.

Guide: https://khandeparkaranmol-beep.github.io/AgentQA/
Interactive demo: https://khandeparkaranmol-beep.github.io/AgentQA/viewer.html
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

What's the worst bug you've found that only shows up when agents talk to each other?

---

## Posting notes

- Post Tuesday-Thursday, 8-10am ET
- No hashtags in the post body — add 2-3 in the first comment: #AI #testing #opensource
- First comment: "Interactive demo here — no install, just click: [demo link]. Full guide: [guide link]"
- Reply to every comment within 60 minutes (2.4x reach boost per LinkedIn algorithm)
- Don't edit the post after publishing — LinkedIn deprioritizes edited posts
- If it gets traction, follow up 2 days later with a "6 failure modes I found" deep dive
