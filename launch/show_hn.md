# Show HN Post

## Title

Show HN: AgentQA – Property-based testing for multi-agent AI systems

## Body

Hi HN,

I built AgentQA because I kept finding bugs in multi-agent systems that no existing tool could catch — information leaking between agents, deadlocks where two agents wait for each other forever, agents repeating themselves in loops. These bugs only show up when agents interact, never in single-agent testing.

AgentQA is a pytest-style testing framework for multi-agent AI systems. You write a YAML scenario describing which agents to test, inject faults (corruption, contradictory instructions, hallucinations), and assert properties that must hold. It runs every scenario N times and reports statistical pass rates.

```yaml
name: "Price negotiation"
agents:
  - name: buyer
    role: "Negotiate the lowest price"
  - name: seller
    role: "Negotiate the highest price"
turns: 10
runs: 5
assertions:
  - name: no_information_leak
  - name: converges_within
    params: { max_turns: 10 }
inject:
  - at_turn: 5
    action: contradictory
    target: buyer
```

```bash
pip install agentqa
agentqa run scenario.yaml
```

It ships 15 property checkers covering information leaks, deadlocks, role violations, step repetition, convergence failures, and more. The checkers are based on the MAST failure taxonomy (NeurIPS 2025) which identified 14 empirical failure modes in multi-agent systems.

The trace viewer exports to a single self-contained HTML file — no server, no account. Three view modes: a cinematic spotlight view for presentations, a network constellation view, and a traditional swimlane timeline. Interactive demo: [LINK_TO_GITHUB_PAGES]

Works with any Python agent — raw callables, CrewAI, LangGraph. MIT licensed.

GitHub: https://github.com/khandeparkaranmol-beep/AgentQA
PyPI: https://pypi.org/project/agentqa/

Would love feedback on:
- What properties would you want to test that we don't cover yet?
- If you're building multi-agent systems, what's the hardest bug you've hit?

---

## Notes for posting

- Post between 8-10am ET on a weekday (Tuesday-Thursday best)
- Don't edit the title after posting — HN penalizes edits
- Replace [LINK_TO_GITHUB_PAGES] with your actual demo URL once GitHub Pages is live
- Reply to every comment within the first 2 hours
- If someone asks a technical question, go deep — HN rewards substance
- Don't mention Product Hunt, launches, or anything marketing-flavored
