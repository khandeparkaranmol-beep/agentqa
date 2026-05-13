---
name: social-launch-posts
description: Write high-engagement posts for LinkedIn and Hacker News (Show HN). Use this skill whenever the user wants to write a LinkedIn post, HN post, Show HN submission, social media copy for a product launch, or needs help crafting announcements for technical or professional audiences. Also trigger when the user says "write a post", "announce this", "draft a Show HN", "LinkedIn copy", "launch post", "how should I announce this", or shares a product/project and asks for help getting the word out. This skill is mandatory for any LinkedIn or HN writing — do NOT use generic copywriting advice. Even casual mentions like "I should post about this" or "how do I share this on HN" should activate it. Also trigger for non-launch LinkedIn content: thought leadership, lessons learned, project updates, career milestones, and industry commentary.
---

# Social Launch Posts — LinkedIn & Hacker News

Write posts that get real engagement on LinkedIn and Hacker News. These are two fundamentally different platforms with different algorithms, audiences, and norms. A post that works on LinkedIn will get downvoted on HN. Never cross-post the same copy.

---

## Before Writing: Platform Fit Check

Not every product belongs on both platforms. Before drafting, determine what to write:

**Belongs on both LinkedIn + HN:**
- Open source dev tools, libraries, frameworks
- Technical infrastructure (databases, APIs, CLI tools)
- Developer-facing SaaS with a free tier or OSS core
- Research tools with a technical audience

**LinkedIn only (skip HN):**
- Consumer apps, B2B SaaS without a technical angle
- Closed-source products without a GitHub repo
- Career/hiring announcements, personal milestones
- Non-technical products (design tools, marketing platforms, etc.)
- Thought leadership, industry commentary, lessons learned

**HN only (skip LinkedIn):**
- Highly technical niche tools (compiler plugins, kernel modules)
- Research papers, benchmarks, technical write-ups
- Privacy/security tools where the LinkedIn audience wouldn't care

If the product doesn't fit a platform, say so and explain why — then write only for the platform that fits. This is more valuable than forcing a post onto the wrong audience.

---

## LinkedIn

### Algorithm Signals (2025-2026)

Apply these silently — don't explain the algorithm to the user, just write posts that exploit it:

- **Dwell time** is the #1 ranking signal. Every paragraph must earn the next scroll.
- **Comments weigh 2x vs likes.** Always end with a specific, answerable question.
- **First 60 min replies = 2.4x reach.** Include this in posting notes.
- **Engagement bait is penalized.** LinkedIn's NLP detects "Comment YES", "Like to see" patterns. Never use them.
- **Editing deprioritizes.** Get it right before posting.
- **Native video autoplay** = 3-5x reach over link posts.

### Hook (Must Land in 2 Lines)

The hook appears before LinkedIn's "see more" fold (~150 chars). Three types, ranked by what they optimize:

**Narrative** (optimizes dwell time) — start in the middle of a story:
- "Last Tuesday our staging environment caught a bug that would have cost $40K in production."
- "I spent three hours debugging a problem that turned out to be two services politely waiting for each other."

**Contrarian** (optimizes comments) — challenge a common assumption:
- "Your CI pipeline tests everything except the one thing that actually breaks in production."
- "We deleted 2,000 lines of test code and our bug rate dropped."

**Data** (optimizes shares) — lead with a surprising, specific number:
- "I analyzed 500 deploys and found that 34% of outages come from a single class of bug."
- "Our error rate was 23%. Not because the code was bad — because we were testing the wrong thing."

**Never open with:**
- "Excited to announce..." / "Thrilled to share..." (centers you, not the reader)
- "After months of hard work..." (nobody cares about your timeline)
- Superlatives: "game-changing", "revolutionary", "disrupting" (instant scroll-past)

### Post Structure

```
HOOK (2 lines) — Story, contrarian, or data
  ↓ reader clicks "see more"
PROBLEM (3-4 lines) — Concrete pain with specific examples
  ↓ reader recognizes their problem
SOLUTION (3-4 lines) — What you built, shown in action (commands > pitch)
  ↓ reader wants to try it
CAPABILITIES (4-6 lines) — Key features, scannable (use → arrows, not bullets)
  ↓ reader sees depth
TRUST (1-2 lines) — Open source / MIT / research-backed / user count
LINKS (3 lines) — Guide, demo, GitHub — one per line, labeled
QUESTION (1-2 lines) — Specific, about the reader's experience
```

For **non-technical products**, replace SOLUTION/CAPABILITIES with:
```
WHAT I BUILT (2-3 lines) — Plain language, no jargon
WHY IT MATTERS (3-4 lines) — The emotional/practical payoff for the user
SOCIAL PROOF (2-3 lines) — Early users, waitlist numbers, testimonials
```

Keep paragraphs to 2-3 lines. Use `→` arrows for lists (feels conversational, not like docs). Mobile readers bail on walls of text.

### Closing Question

The question drives comments (weighted 2x). It must be specific enough that the reader already has an answer from their own experience.

**Weak** (too broad, nobody responds):
- "What do you think?" / "Thoughts?" / "Let me know your feedback!"

**Strong** (the reader's brain immediately starts composing an answer):
- "What's the worst production bug you've found that no test caught?"
- "What's one tool you wish existed for [specific domain]?"
- "How does your team handle [specific problem the product solves]?"

The question should be about **the reader's experience**, not your product.

### Posting Notes (Include with Every Draft)

Always append tactical notes:
- **Timing:** Tuesday-Thursday, 8-10am ET
- **Hashtags:** 0 in post body; 2-3 in first comment
- **First comment:** Re-link the demo/guide with a short CTA
- **Reply cadence:** Every comment in first 60 min, then every 2-3 hours for 24h
- **Follow-up:** If traction, post a deep-dive 2 days later
- **Video:** If user has a demo video, recommend native upload (not YouTube link)

---

## Hacker News (Show HN)

### Algorithm & Culture

- **First 30 minutes decide rank.** Need ~8-10 upvotes + 2-3 comments to crack the top 10. Gravity increases every 45 min — early velocity beats total count.
- **Comment depth = quality signal.** 150 upvotes + 80 comments beats 200 upvotes + 5 comments.
- **Vote manipulation is detected.** Coordinated upvoting from same IPs / new accounts / single-purpose accounts = flagged. Never ask for upvotes. Say "check it out and share thoughts."
- **Don't edit the title** — HN penalizes edits.
- **No emoji.** HN culture treats emoji in technical posts as unprofessional.
- **No marketing language.** "Excited", "game-changing", "thrilled" = instant downvotes.

### Title

The title is the only thing 90% of HN readers see. It must be specific and honest.

**Formula:** `Show HN: [Name] – [what it concretely does]`

Good titles are specific about the outcome:
- `Show HN: Snaptest – Visual regression testing in 3 lines of Rust`
- `Show HN: PromptGuard – Catches 94% of prompt injection attacks with <2ms overhead`

Bad titles are vague or use superlatives:
- `Show HN: Snaptest – The Ultimate Visual Testing Platform`
- `Show HN: A fast and powerful testing tool`

Max ~80 characters before HN truncates.

### Body Structure

HN readers are technical, skeptical, and will check your GitHub. The body should read like a builder explaining their work to a peer, not a company announcing a product.

```
CONCRETE EXAMPLE (3-4 lines)
  Start with a specific scenario where the tool catches something real.
  Not "I built X because Y" — show the failing test case first.

WHAT IT IS (2-3 lines)
  One-sentence positioning. What category, what's different.

CODE BLOCK (4-6 lines)
  pip install / npm install → usage → output. In a fenced code block.
  HN readers evaluate tools by how they feel to use.

HOW IT WORKS (5-8 lines)
  Architecture, not marketing. Explain the approach, the tradeoffs,
  why you chose technique A over B. This is where HN decides if you're serious.

CONCRETE OUTPUT (code block, 4-5 lines)
  Show real CLI output, pass rates, or results the reader would see.

TECHNICAL DETAILS (3-5 lines)
  The 2-3 most technically interesting aspects. Not a feature list —
  the things that made you think "that's clever" while building.

LINKS (3-4 lines)
  GitHub (mandatory), live demo, docs, package registry.

QUESTION (1-2 lines)
  Ask about a technical gap: "What failure modes am I missing?"
  "What would you want this to check that it doesn't?"
```

### Tone

Write like a builder explaining their project to another builder over coffee.

**Do:**
- Share tradeoffs honestly: "This doesn't handle X yet — that's next."
- Use technical terms correctly (HN readers will call you out if you misuse them)
- Preemptively address "why not just use X?" — the top comment on every Show HN
- Show the GitHub link early — readers will check code quality before engaging
- Mention limitations before someone else does
- Include dependency count / LOC if the tool is small and focused — HN respects lean code

**Don't:**
- Marketing language of any kind
- Name-drop investors, press coverage, or growth metrics
- Mention other launch platforms (Product Hunt, etc.)
- Start with "Hi HN," (wastes your most valuable line)
- Oversell: let the reader judge quality

### Preemptive "Why Not Just X?" Defense

Every Show HN gets this comment. Prepare by addressing it in the post body or drafting a reply. The pattern:

1. **Identify the obvious alternative** the reader will suggest (existing tool, built-in language feature, simpler approach)
2. **Acknowledge it's reasonable** — don't dismiss the alternative
3. **Explain the specific gap** your tool fills that the alternative doesn't
4. **Be concrete** — "pytest tests functions; this tests conversations between agents" beats "this is more powerful than pytest"

Include one "why not just X" in the post body. Draft 2-3 more as reply templates in the posting notes.

### Posting Notes (Include with Every Draft)

- **Timing:** Tuesday-Thursday, 8-10am ET (or Sunday midnight PT for less competition)
- **Reply cadence:** Every comment within 2 hours; go deep on technical questions
- **Prepared replies:** Draft 2-3 "why not X" responses ready to paste
- **Don't:** Mention other launches, ask for upvotes, get defensive at criticism
- **Do:** Engage with other Show HN posts that day; acknowledge valid criticism; thank anyone who files issues or PRs

---

## Writing Process

### Step 1: Gather Context

Before writing, you need answers to these. If the user has already shared enough context (e.g., they've been building the product in this conversation, or they provided a detailed description), don't ask redundant questions — extract what you can and only ask about what's genuinely missing.

**Must-have (ask if missing):**
- What does it do? (one sentence, no jargon)
- Links: GitHub, demo, guide, package registry
- Open source? License? (determines HN viability)

**Should-have (infer from context, ask only if you can't):**
- Who is it for? (specific persona, not "developers")
- What's the most interesting thing about it? (this becomes the hook)
- Install + demo flow? (ideally ≤3 commands)
- A concrete example of it working? (specific scenario, not abstract)
- How is it different from alternatives? (the "why not X" defense)
- Any hard numbers? (benchmark stats, user counts, performance claims)

If you're in a conversation where you've already been helping build the product, you likely have all of this. Don't re-interview — just write.

### Step 2: Write Both Drafts Separately

Write LinkedIn and HN versions independently. Don't adapt one from the other — they should share facts but differ in everything else: hook type, structure, tone, level of technical detail, and CTA.

If only one platform fits (per the platform fit check above), write only that one and explain why the other isn't a good fit.

### Step 3: Self-Edit Pass

For each draft, do one pass asking:
1. Does the hook work in isolation? (2 lines for LinkedIn, title-only for HN)
2. Would a skeptical reader keep scrolling? (cut anything that reads like an ad)
3. Is the code/demo shown in the first 40% of the post?
4. Is the closing question specific enough that a reader already has an answer?
5. Read it as a competitor — does anything feel exaggerated or cringey?
6. Is there any redundancy? (saying the same thing twice in different words)
7. Could any sentence be cut without losing meaning? (if yes, cut it)

### Step 4: Produce Final Output

Deliver:
- The LinkedIn post (ready to copy-paste — no markdown formatting, just plain text as it would appear on LinkedIn)
- The HN title + body (ready to paste — title separate from body, body uses HN's markdown: blank lines for paragraphs, indented code blocks)
- Posting notes for each (timing, first-comment text, reply templates for likely questions)

Save each as a separate file in the user's workspace (e.g., `launch/linkedin.md`, `launch/show_hn.md`). Include the posting notes in each file after a `---` separator.

---

## Worked Example (Dev Tool)

To show the difference between platforms for the same product:

**Product:** "Snaptest" — visual regression testing CLI, written in Rust, open source

**LinkedIn version:**
```
I spent 3 hours debugging a CSS change that looked fine locally but broke
checkout on mobile. A one-pixel padding shift cascaded into a $12K drop in
conversions before anyone noticed.

That's why I built Snaptest.

cargo install snaptest
snaptest init .
snaptest run --baseline

It takes screenshots of your web app, diffs them pixel-by-pixel against a
baseline, and flags visual regressions before they ship. Runs in CI, works
with any framework.

→ 0.3s per screenshot (Rust-native rendering)
→ Perceptual diffing (ignores anti-aliasing noise)
→ GitHub Actions + GitLab CI templates included

Open source. MIT licensed.

Guide: [link]
Interactive demo: [link]
GitHub: [link]

What's the most expensive visual bug your team has shipped?
```

**HN version:**
```
Title: Show HN: Snaptest – Pixel-level visual regression testing in Rust

Body:
Here's the bug this catches: a 1px padding change in a shared component
silently breaks the checkout flow on mobile viewports. No test fails.
No lint error. You find out when conversion drops.

Snaptest screenshots your web app and diffs against a committed baseline:

  cargo install snaptest
  snaptest init .
  snaptest run --baseline

It uses perceptual diffing (not raw pixel comparison) so anti-aliasing
and subpixel rendering differences don't create false positives. The
diff algorithm is adapted from the SSIM paper with a custom threshold
tuned for UI testing.

0.3s per screenshot using Rust-native headless rendering (no Puppeteer).
~4K lines of Rust, no runtime dependencies beyond the binary.

GitHub Actions and GitLab CI templates ship with the package. Baseline
images commit to your repo — PRs show visual diffs inline.

GitHub: [link]
Demo: [link]

What visual regression approaches have worked (or failed) for your team?
```

Notice: same product, completely different hooks, structure, and tone.

---

## Worked Example (Non-Technical Product)

**Product:** "FocusFlow" — desktop app that blocks distracting sites with AI-learned patterns

**LinkedIn version:**
```
I tracked my screen time for 30 days. I was "working" for 9 hours a day
but producing real output for about 4.5.

The other 4.5 hours? Reddit, Twitter, Slack rabbit holes, and "quick"
YouTube breaks that lasted 25 minutes.

So I built FocusFlow — a desktop app that blocks distracting sites during
work hours. But here's what makes it different: it learns YOUR patterns.

It watches when you're deep in flow vs. when you're drifting, and
adjusts your block schedule automatically. After a week of learning,
it suggested a focus/break rhythm I never would have designed myself —
and my deep work hours went from 4.5 to 6.8.

Free during beta. No account required.

→ focusflow.app

What's your biggest distraction trap during the workday?
```

**HN recommendation:** Skip HN — this is a consumer app, not open source, no GitHub repo. HN's audience won't engage meaningfully. Focus the energy on LinkedIn, Twitter/X, and relevant subreddits (r/productivity, r/ADHD).
