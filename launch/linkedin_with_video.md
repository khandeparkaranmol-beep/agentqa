# LinkedIn Post (with video)

Everyone's building multi-agent AI systems. Nobody's testing them.

I kept finding bugs that only show up when agents talk to each other:

→ An agent leaks another agent's private budget mid-negotiation
→ Two agents deadlock, each waiting for the other forever
→ A buyer repeats "I offer $210" four times in a loop
→ A task gets marked "done" before it's actually finished

None of these show up in single-agent testing. They only emerge in the interaction.

So I built AgentQA.

Write a scenario in YAML. Inject faults (hallucinations, contradictions, message drops). Assert properties. Run it 50 times. Get statistical pass rates — not a single pass/fail.

The video above shows the trace viewer — a single HTML file, no server, no account. Three views: Spotlight (cinematic replay), Constellation (agent network), and Timeline (swimlane diagram). Watch agents negotiate, see where checks fail, spot the exact turn things went wrong.

15 property checkers based on the MAST failure taxonomy (NeurIPS 2025). Works with any Python agent framework.

pip install agentqa

Open source. MIT licensed.

GitHub: https://github.com/khandeparkaranmol-beep/AgentQA
Try the demo (no install): [LINK_TO_GITHUB_PAGES]

What's the worst multi-agent bug you've shipped to production?

---

## Posting notes

- Attach agent-qa-upload.mov as a native LinkedIn video (not a YouTube link — native gets 3-5x more reach)
- Post Tuesday-Thursday, 8-10am ET
- No hashtags in the post body — add 3 in the first comment: #AI #testing #opensource
- First comment: "Interactive demo here — no install, just click: [LINK]. Also on PyPI: pip install agentqa"
- Reply to every comment in the first hour
- The video is the hook — LinkedIn autoplay means people will see the viewer before they read a word
