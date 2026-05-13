# LinkedIn Post (with video) — Riftcheck v0.7

_Uses the same Iteration 5 final copy as linkedin.md, adapted for video context._

I watched two AI agents deadlock for 47 turns — each politely waiting for the other to go first. Both passed their unit tests.

That's the blind spot: we test agents in isolation, but the bugs live in the conversation between them. Information leaks, infinite loops, tasks marked "done" before they're finished — none of this shows up until agents interact.

I built Riftcheck to catch these before production does.

pip install riftcheck
riftcheck init .
riftcheck run scenario.yaml --view

Point it at your existing code (CrewAI, LangGraph, AutoGen, or raw Python). It AST-scans your agents, generates adversarial test scenarios with fault injection, runs them multiple times, and reports pass rates with confidence intervals — so you know whether 4/5 passing is signal or noise.

The video above shows the trace viewer in action — a single HTML file, no server, no account. Three views: Spotlight (cinematic replay), Constellation (agent network), Timeline (swimlane). Watch agents negotiate, see where checks fail, spot the exact turn things go wrong.

16 property checkers. Five fault types.

Guide: https://riftcheck.ai/
Interactive demo: https://riftcheck.ai/viewer.html


What's the worst bug you've found that only shows up when agents talk to each other?

---

## Posting notes

- Attach agent-qa-upload.mov as a native LinkedIn video (not a YouTube link — native gets 3-5x more reach)
- Post Tuesday-Thursday, 8-10am ET
- No hashtags in the post body — add 2-3 in the first comment: #AI #testing #opensource
- First comment: "Interactive demo here — no install, just click: [demo link]. Full guide: [guide link]"
- Reply to every comment within 60 minutes (2.4x reach boost)
- The video is the hook — LinkedIn autoplay means people will see the viewer before they read a word
