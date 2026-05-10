# Developer Interview Script — AgentQA Validation

*20-minute calls. Mom Test rules: no leading questions, no pitching, listen more than talk.*

---

## Before the Call

**Finding interviewees (aim for 5):**
- Search LinkedIn for: "multi-agent AI" OR "AI agent platform" OR "agent orchestration" in titles/posts
- Look at contributors to CrewAI, LangGraph, AutoGen repos on GitHub
- Check who's posting about agent coordination on Twitter/X
- DM on Discord (CrewAI, LangGraph, A2A communities)

**Qualifying question (in the DM):** "Are you running 3+ AI agents that interact with each other in production or staging? I'm researching how teams handle testing for multi-agent systems — would love 20 minutes of your time."

**Disqualify if:** they're only using single-agent setups, or only in experimentation (no real users/workloads).

---

## The Script

### Opening (2 min)

> "Thanks for taking the time. I'm researching how teams building multi-agent AI systems handle testing and reliability. I'm not selling anything — just trying to understand how people actually work. Everything you share stays between us. Mind if I take notes?"

### Part 1: Their Setup (3 min)

**Q1: "Can you walk me through your multi-agent setup? How many agents, what do they do, how do they interact?"**

*Listen for: number of agents, whether they truly interact (vs. sequential pipeline), what coordination patterns they use, which framework.*

**Q2: "How long has this been in production? How many users or workloads does it handle?"**

*Listen for: maturity (weeks vs. months), scale (10 vs. 10,000 daily runs). More mature = more credible pain.*

### Part 2: The Pain (8 min — this is the core)

**Q3: "What's the worst bug you've hit that was caused by agents interacting with each other — not a single agent failing, but the interaction between them?"**

*Listen for: specific stories. If they have one, probe deep: "What happened? How did you find it? How long did it take to fix?" The specificity of the story tells you how real the pain is.*

**Q4: "How often do you hit coordination issues like that? Weekly? Monthly? Rarely?"**

*Listen for: frequency. Weekly = acute pain. Monthly = moderate. "Rarely" or "never" = they might not have enough agents interacting, or they're not monitoring closely enough.*

**Q5: "When something goes wrong between agents, how do you figure out what happened?"**

*Listen for: their current debugging workflow. "I read the logs" = painful manual process. "We built a custom script" = they've invested time in workarounds. "We just restart and hope" = extreme pain with no solution.*

**Q6: "Before you deploy changes, how do you test that your agents will still coordinate correctly?"**

*Listen for: "We don't" (most common — validates the gap), "We wrote some integration tests but they don't catch the emergent stuff" (they know the problem exists), or "We have a staging environment" (probe: does it actually test interactions or just individual agents?).*

### Part 3: Current Solutions (4 min)

**Q7: "Have you tried any tools or frameworks for testing agent interactions? What worked, what didn't?"**

*Listen for: whether they've looked (awareness of the problem), what they tried (LangSmith, Maxim, custom scripts), and what fell short. "It traces individual agents but doesn't test how they interact" = direct validation of AgentQA's positioning.*

**Q8: "If you could wave a magic wand and have any testing capability for your multi-agent system, what would it be?"**

*Listen for: their dream feature. This shapes your MVP. Common answers might be: "simulate my full agent swarm before deploying," "replay a production failure and see exactly which agent message caused it," "test what happens under adversarial conditions." Whatever they say, don't react — just write it down.*

### Part 4: Willingness to Pay (3 min)

**Q9: "How much time does your team spend per week on debugging agent coordination issues?"**

*Listen for: hours/week. Multiply by their hourly rate to estimate the cost of the problem. 5 hours/week × $75/hr = $375/week = $1,500/month of pain. This is your pricing anchor.*

**Q10: "If a tool existed that could simulate your agents interacting under hundreds of scenarios before you deploy — catching deadlocks, information leaks, cascading failures — what would that be worth to your team per month?"**

*Don't suggest a number. Let them anchor. If they say a number, probe: "What would it need to do to be worth that?" If they struggle to name a number, try: "Would $200/month be a no-brainer, or would you need to think about it?"*

---

## After the Call

Fill in one row per interview:

| # | Name/Role | Company size | Agent count | Framework | Worst coordination bug | How they test today | Dream feature | Hours/week debugging | WTP ($/month) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |

## Signal Assessment

After all 5 calls:

**STRONG signal (proceed to build):**
- 3+ interviewees describe specific coordination bugs
- 3+ say "we don't test interactions" or "our testing doesn't catch the emergent stuff"
- 2+ name a WTP of $200+/month without prompting
- At least 1 says "I would use this today"

**MODERATE signal (refine ICP, do 5 more calls):**
- 2 interviewees describe coordination bugs
- Mixed testing approaches (some have workarounds, some don't)
- WTP is hesitant or low (<$100/month)

**WEAK signal (reconsider the idea):**
- Most interviewees say "we haven't really hit that problem"
- They test coordination and it works fine
- No one names a meaningful WTP
