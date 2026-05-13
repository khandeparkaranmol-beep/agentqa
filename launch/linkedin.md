# LinkedIn Post — Riftcheck v1.0.1

## Final Post (copy-paste ready)

Every agent in your system passes its unit tests. Then they talk to each other and everything breaks.

One leaks a private budget mid-negotiation. Two get stuck in a politeness loop for 47 turns. A task gets marked "done" three turns before anyone finishes it. An agent ignores instructions from its peer and goes off-script.

None of this shows up in isolation. The bugs live in the conversation between agents. And nobody's testing that.

I built Riftcheck to find these bugs before production does.

It's a Python CLI. Three commands:

  pip install riftcheck
  riftcheck init .
  riftcheck run scenario.yaml --view

Point it at your existing codebase — CrewAI, LangGraph, AutoGen, or raw Python. It scans your agents, generates adversarial scenarios, injects faults between them, and runs everything multiple times with statistical confidence intervals. Not a single green checkmark. Actual pass rates you can trust.

The --view flag opens a trace viewer — a single HTML file, no server, no account. You can watch exactly where the conversation broke down.

Guide → https://riftcheck.ai/
Interactive demo → https://riftcheck.ai/viewer.html

What's the worst bug you've found that only appears when agents talk to each other?

---

## Posting notes

- Post Tuesday-Thursday, 8-10am ET
- No hashtags in the post body — add 2-3 in the first comment: #AI #testing #agents
- First comment: "Interactive demo — no install, just click: [demo link]. Full guide with examples: [guide link]"
- Reply to every comment within 60 minutes (2.4x reach boost per LinkedIn algorithm)
- Don't edit the post after publishing — LinkedIn deprioritizes edited posts
- If it gets traction, follow up 2 days later with a deep dive: "6 failure modes I found testing multi-agent systems" (information leaks, deadlocks, premature completion, role violations, reasoning gaps, coordination failures)
- If you have a trace viewer screen recording, upload as native LinkedIn video (not YouTube link) — native gets 3-5x more reach

## "Why not just X?" reply templates

**"Why not just use pytest / unit tests?"**
pytest tests functions. Riftcheck tests conversations. A unit test checks that Agent A responds correctly to a fixed input. Riftcheck checks what happens when Agent A's response causes Agent B to leak private data, deadlock, or go off-task — across multiple runs with fault injection. They're complementary. Riftcheck actually ships as a pytest plugin.

**"Why not just log and review traces manually?"**
You can — until you have 50 scenarios running 5x each. Riftcheck automates the property checking (16 checkers covering information flow, coordination, reasoning, and completion) and gives you statistical confidence instead of eyeballing. The trace viewer is there for when you need to dig in.

**"How is this different from LangSmith / Braintrust / other observability tools?"**
Those are observability — they show you what happened after the fact. Riftcheck is testing — it generates adversarial scenarios, injects faults, and checks properties before you deploy. The difference between APM and a test suite.
