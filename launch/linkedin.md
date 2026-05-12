# LinkedIn Post

Everyone's building multi-agent AI systems. Nobody's testing them.

I spent months watching agents fail in ways that no existing tool could catch:

→ Agent B accidentally sees Agent A's private budget
→ Two agents deadlock waiting for each other forever
→ An agent repeats the same message 4 times in a loop
→ A "completed" task that was never actually finished

These bugs never show up when you test agents individually. They only emerge when agents talk to each other.

So I built AgentQA — a testing framework that simulates multi-agent interactions before they hit production.

Write a YAML scenario. Inject faults. Assert properties. Run it 50 times. Get statistical pass rates instead of a single pass/fail.

It catches information leaks, deadlocks, role violations, convergence failures, and 11 more failure modes based on the MAST taxonomy (NeurIPS 2025).

The trace viewer exports to a single HTML file — no server, no account. Three cinematic view modes that make agent interactions actually watchable.

pip install agentqa

Open source. MIT licensed. Works with any Python agent framework.

Interactive demo: [LINK_TO_GITHUB_PAGES]
GitHub: https://github.com/khandeparkaranmol-beep/AgentQA

If you're building with multiple AI agents, I'd love to hear: what's the worst multi-agent bug you've shipped to production?

---

## Posting notes

- Post Tuesday-Thursday, 8-10am ET
- No hashtag spam — 3 max if any: #AI #testing #opensource
- First comment: pin the demo link again with "Interactive demo here — no install needed, just click"
- Reply to every comment in the first hour
- If it gets traction, follow up 2 days later with a "what I learned" post
