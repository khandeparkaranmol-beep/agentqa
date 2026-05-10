# Week 1 — Claude Code Chunks

*Each chunk is one Claude Code session (~15-30 min). Run them in order. Verify after each before moving to the next. Commit after each passing chunk.*

---

## Chunk 1: Scaffold the repo (15 min)

**Verify by:** `pip install -e ".[dev]"` succeeds, `agentqa --help` prints something

**Prompt to paste into Claude Code:**

```
Initialize the AgentQA Python project. Read CLAUDE.md for full project context.

Do these things:
1. Create pyproject.toml with:
   - name: agentqa
   - version: 0.1.0
   - python_requires: >=3.10
   - dependencies: pyyaml, click, pydantic>=2.0
   - optional dev dependencies: pytest, pytest-cov, ruff
   - entry point: agentqa = agentqa.cli:main
   - use src layout (src/agentqa/)

2. Create the full directory structure from CLAUDE.md with empty __init__.py files in every package

3. Create a minimal cli.py with a Click group and one placeholder command:
   agentqa run <path> --runs N (default 5)
   Just print "Would run scenarios from {path} with {runs} runs" for now.

4. Create .gitignore (Python standard + .env + dist/ + *.egg-info)

5. Create a minimal README.md with just the project name and one-line description

6. Initialize git repo, make initial commit

Don't create any actual logic yet — just the skeleton.
```

---

## Chunk 2: Core data models (15 min)

**Verify by:** `python -c "from agentqa.agent import AgentUnderTest; print('OK')"` works

**Prompt:**

```
Read CLAUDE.md for context. Now implement the core data models for AgentQA.

1. In src/agentqa/agent.py:
   - Create Message as a Pydantic BaseModel with fields: sender (str), receiver (str), content (str), turn (int), metadata (dict, default empty), timestamp (float, default 0.0)
   - Create Response as a Pydantic BaseModel with: content (str), metadata (dict, default empty)
   - Create AgentUnderTest as an abstract base class (ABC) with:
     - name: str property (abstract)
     - receive(message: Message) -> Response (abstract method)
     - get_state() -> dict (abstract method)
     - setup() -> None (optional, default no-op — called before simulation starts)
     - teardown() -> None (optional, default no-op — called after simulation ends)

2. In src/agentqa/trace.py:
   - Create TraceEvent as a Pydantic BaseModel with: type (Literal["message", "state_change", "fault_injected", "property_check"]), turn (int), agent (str | None), data (dict), timestamp (float)
   - Create Trace class that:
     - Holds a list of TraceEvents
     - Has add_event(event: TraceEvent) method
     - Has get_messages() -> list[TraceEvent] that filters for type=="message"
     - Has get_events_for_agent(name: str) -> list[TraceEvent]
     - Has to_jsonl(path: Path) method that writes each event as one JSON line
     - Has a from_jsonl(path: Path) classmethod that reads back

3. In src/agentqa/scenario.py:
   - Create these Pydantic models: AgentConfig (name: str, role: str | None, config: dict default empty), FaultConfig (at_turn: int, action: str, target: str, params: dict default empty), PropertyConfig (name: str, params: dict default empty), ScenarioConfig (name: str, agents: list[AgentConfig], turns: int default 20, inject: list[FaultConfig] default empty, assertions: list[PropertyConfig] default empty, runs: int default 5, setup: dict default empty)
   - Create load_scenario(path: Path) -> ScenarioConfig that reads a YAML file and validates it into ScenarioConfig

4. Write a quick test in tests/test_models.py that creates a Message, a TraceEvent, a ScenarioConfig, and serializes/deserializes them.

Run the test. Commit if it passes.
```

---

## Chunk 3: Raw Python adapter (15 min)

**Verify by:** Run the test — a raw Python function wrapped as an agent can receive a message and respond

**Prompt:**

```
Read CLAUDE.md for context. Implement the raw Python adapter — the simplest possible way to wrap a Python function as an AgentUnderTest.

1. In src/agentqa/adapters/raw.py:
   - Create RawAgent(AgentUnderTest) that wraps a plain Python callable
   - Constructor takes: name (str), handler (Callable that takes a dict with 'sender', 'content', 'turn' keys and returns a str or dict with 'content' key), initial_state (dict, optional)
   - receive() calls the handler, returns a Response
   - get_state() returns the current state dict
   - The handler can optionally modify state by accepting a second 'state' parameter (check with inspect)

2. In src/agentqa/adapters/__init__.py:
   - Export RawAgent

3. Write a test in tests/test_raw_adapter.py:
   - Create a simple echo agent that returns "Echo: {message.content}"
   - Create a stateful counter agent that counts messages received
   - Verify receive() returns correct responses
   - Verify get_state() reflects state changes

Run tests. Commit if passing.
```

---

## Chunk 4: Simulation engine core (30 min)

**Verify by:** Run a 2-agent simulation in a test, get a Trace with message events

**Prompt:**

```
Read CLAUDE.md for context. This is the most important chunk — build the simulation engine.

1. In src/agentqa/engine.py:
   - Create SimulationEngine class
   - Constructor takes: agents (list[AgentUnderTest]), scenario (ScenarioConfig)
   - run_once() -> Trace method that:
     a. Calls setup() on each agent
     b. Runs a turn loop for scenario.turns iterations
     c. Each turn: picks the "active" agent (round-robin for now), constructs a Message from the previous turn's response (or an initial prompt from scenario.setup for turn 0), calls active_agent.receive(message), records the message and response as TraceEvents in the Trace, records a state_change event with get_state() after each agent acts
     d. Calls teardown() on each agent
     e. Returns the completed Trace
   - run(n: int | None = None) -> list[Trace] method that:
     a. Runs run_once() n times (defaults to scenario.runs)
     b. Returns list of all traces

   IMPORTANT design decision for turn 0: The first agent needs something to respond to. Use scenario.setup dict — if it has a key matching an agent's name, that value is the initial prompt sent TO that agent. If no setup, send a generic "Begin the interaction." message.

   IMPORTANT: The engine orchestrates ALL communication. Agent A's response becomes Agent B's input on the next turn. Agents never call each other directly.

2. Write a test in tests/test_engine.py:
   - Create two RawAgents:
     - "buyer" that says "I offer $X" (incrementing by 500 each turn starting at 5000)
     - "seller" that says "I counter at $Y" (decrementing by 500 from 12000)
   - Create a ScenarioConfig with 6 turns, 1 run
   - Run the simulation
   - Assert: trace has the right number of message events, messages alternate between buyer and seller, content contains expected patterns

Run tests. Commit if passing.
```

---

## Chunk 5: Scenario YAML loading + CLI wiring (20 min)

**Verify by:** Create a YAML file, run `agentqa run scenario.yaml`, see output

**Prompt:**

```
Read CLAUDE.md for context. Wire together the scenario loader and CLI so a developer can run a scenario from a YAML file.

1. Update src/agentqa/scenario.py if needed:
   - Ensure load_scenario handles file-not-found with a clear error message
   - Validate that agent names in 'inject' and 'assertions' reference agents defined in 'agents'

2. Update src/agentqa/cli.py:
   - The `run` command should:
     a. Accept a path (file or directory)
     b. If directory, find all .yaml and .yml files in it
     c. Load each scenario with load_scenario()
     d. For now, just print the loaded scenario config (we'll wire the engine in the next chunk)
     e. Accept --runs flag that overrides scenario.runs
     f. Accept --verbose flag for debug output

3. Create examples/negotiation/scenario.yaml:
   ```yaml
   name: "Basic price negotiation"
   agents:
     - name: buyer
       role: "Negotiate the lowest price for a widget"
     - name: seller
       role: "Negotiate the highest price for a widget"
   turns: 10
   runs: 3
   setup:
     buyer:
       budget: 10000
     seller:
       floor_price: 7000
   assertions:
     - name: converges_within
       params:
         max_turns: 10
   ```

4. Create examples/negotiation/agents.py:
   - Define a simple buyer and seller as RawAgent instances (hardcoded logic, not LLM-powered — just for testing the framework)
   - Buyer starts at 5000, increments by 500 each turn
   - Seller starts at 12000, decrements by 500 each turn
   - When their prices cross, they agree

Test: `agentqa run examples/negotiation/scenario.yaml` loads and prints the config.

Commit if working.
```

---

## Chunk 6: Wire engine to CLI + terminal output (25 min)

**Verify by:** `agentqa run examples/negotiation/` shows a live agent conversation in the terminal

**Prompt:**

```
Read CLAUDE.md for context. Wire the simulation engine to the CLI and add human-readable terminal output.

1. The challenge: scenarios define agents by name, but the engine needs actual AgentUnderTest instances. For now, solve this with a simple agent registry pattern:
   - In src/agentqa/agent.py, add an AgentRegistry class:
     - register(name: str, agent: AgentUnderTest)
     - get(name: str) -> AgentUnderTest
     - This is a simple dict wrapper
   - In the CLI, the developer specifies agents via a Python file (like conftest.py for pytest). Add a --agents flag that points to a Python file. The CLI imports it and looks for a dict called `agents` mapping names to AgentUnderTest instances. Default: look for agents.py in the same directory as the scenario.

2. Update cli.py `run` command:
   - Load agents from the agents file
   - Create SimulationEngine with agents + scenario
   - Call engine.run()
   - For each trace (run), print a human-readable summary

3. Create src/agentqa/display.py for terminal output:
   - print_trace(trace: Trace, scenario_name: str, run_number: int) function
   - Format each message as:
     ```
     [Turn 3] buyer → seller:
       "I offer $7,000 for the widget."
     ```
   - At the end of each run, print a summary: total turns, which agents participated, whether it completed or hit the turn limit
   - After all runs, print aggregate: "3/3 runs completed within turn limit"

4. Also save traces as .jsonl to a configurable output directory (default: .agentqa/traces/)

Test: `agentqa run examples/negotiation/ --agents examples/negotiation/agents.py`
Should show a readable conversation between buyer and seller.

Commit if working.
```

---

## Chunk 7: Property checker base + first checker (25 min)

**Verify by:** A scenario with `no_information_leak` assertion actually checks for leaks and reports results

**Prompt:**

```
Read CLAUDE.md for context. Build the property checker system and implement the first checker: no_information_leak.

1. In src/agentqa/properties/base.py:
   - Create PropertyChecker as an ABC:
     - name: str (abstract property)
     - check(trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult (abstract method)
   - Create PropertyResult as a Pydantic model:
     - property_name: str
     - passed: bool
     - details: str (human-readable explanation of what happened)
     - evidence: list[TraceEvent] (the specific events that caused pass/fail)
     - turn: int | None (the turn where the violation occurred, if applicable)
   - Create a PropertyRegistry that maps property names to checker instances

2. In src/agentqa/properties/information_leak.py:
   - Create InformationLeakChecker(PropertyChecker):
     - Checks that data marked as private to one agent never appears in messages to other agents
     - How it works:
       a. Look at scenario.setup — each agent's setup dict contains their private data
       b. For each message in the trace, check if any private data from agent A appears in a message FROM a different agent TO a third party (or in a message TO agent A that quotes A's private data back, suggesting it leaked through another path)
       c. "Appears" means: the string value of any private field is found as a substring in the message content (case-insensitive)
     - params: from (str, agent whose data should be private), field (str, which field), to (str, agent who should NOT see it). If not specified, check ALL private fields for ALL agents.
   - Register it in the PropertyRegistry with name "no_information_leak"

3. Update engine.py:
   - After each run_once(), look up the scenario's assertions in PropertyRegistry and run each checker against the trace
   - Store PropertyResults in the Trace (add a results field)

4. Update display.py:
   - After printing the trace, print property results:
     ```
     Properties:
       ✓ no_information_leak — passed (no private data leaked across agents)
     ```
     or:
     ```
     Properties:
       ✗ no_information_leak — FAILED: buyer's "budget" (10000) found in seller's message at turn 5
         Evidence: [Turn 5] seller → buyer: "I know your budget is 10000..."
     ```

5. Update the negotiation example:
   - Make the seller "cheat" — on turn 4, it mentions the buyer's budget in its response
   - Add no_information_leak to the scenario assertions
   - This should FAIL — proving the checker works

6. Write tests in tests/test_properties.py:
   - Test that a clean trace passes
   - Test that a trace with a leak fails with correct evidence

Run tests and the example. The example should show a FAILED property check. Commit.
```

---

## Chunk 8: Remaining property checkers (25 min)

**Verify by:** All 5 property checkers work, negotiation example uses multiple assertions

**Prompt:**

```
Read CLAUDE.md for context. Implement the remaining 4 property checkers.

1. In src/agentqa/properties/convergence.py — converges_within:
   - Checks that the interaction reaches a "done" state within N turns
   - "Done" is defined as: any agent's response contains a configurable completion marker (default: agent response metadata has "done": true, OR message content contains "AGREED" or "DEAL" case-insensitive)
   - params: max_turns (int)
   - Passes if convergence happens within max_turns, fails otherwise

2. In src/agentqa/properties/deadlock.py — no_deadlock:
   - Checks that no state exists where all agents are waiting/stuck
   - Detection: if the last N consecutive messages (default 4) from ALL agents are identical or near-identical (same content after stripping whitespace), that's a deadlock
   - Also detect ping-pong: if two agents alternate the exact same pair of messages for 3+ cycles
   - params: lookback (int, default 4)

3. In src/agentqa/properties/role_boundary.py — role_boundary:
   - Checks that agents only perform actions consistent with their role
   - How: the scenario defines role constraints as a list of "forbidden_actions" per agent (strings). The checker scans message content for these forbidden action patterns.
   - params: agent (str), forbidden_actions (list[str])
   - Example: auditor has forbidden_actions: ["I offer", "I accept", "I counter"] — if auditor sends a message containing any of these, it's a role violation

4. In src/agentqa/properties/output_schema.py — output_schema:
   - Checks that the final collective output matches a JSON schema
   - Looks at the last message's content — tries to parse it as JSON, validates against a provided schema
   - params: schema (dict — a JSON Schema object)
   - If the last message isn't valid JSON, fails with "Final output is not valid JSON"

5. Register all in PropertyRegistry.

6. Update examples/negotiation/scenario.yaml to use multiple assertions:
   - no_information_leak (should fail — seller cheats)
   - converges_within: max_turns: 10 (should pass if agents cross prices)

7. Create a second example: examples/negotiation/scenario_clean.yaml
   - Same setup but seller does NOT cheat
   - All assertions should pass

8. Write tests for each checker in tests/test_properties.py.

Run all tests. Commit.
```

---

## Chunk 9: Multi-run statistics + exit codes (20 min)

**Verify by:** `agentqa run` with --runs 5 shows pass rates, exits with code 1 on failure

**Prompt:**

```
Read CLAUDE.md for context. Add multi-run statistical reporting and proper exit codes for CI/CD.

1. Update engine.py run() method:
   - Already returns list[Trace], each with PropertyResults
   - Add a summarize(traces: list[Trace]) -> RunSummary method
   - RunSummary (Pydantic model): scenario_name, total_runs, property_results (dict mapping property_name to: passes (int), failures (int), pass_rate (float), failure_details (list of per-run details))

2. Update display.py:
   - After all runs complete, print an aggregate summary:
     ```
     === Results: Basic price negotiation (5 runs) ===

     no_information_leak:  2/5 passed (40.0%) ✗ FLAKY
       Run 1: PASSED
       Run 2: FAILED — buyer's "budget" found in seller's message at turn 4
       Run 3: PASSED
       Run 4: FAILED — buyer's "budget" found in seller's message at turn 6
       Run 5: PASSED

     converges_within:     5/5 passed (100.0%) ✓

     Overall: 1/2 properties passed consistently. FAIL.
     ```
   - Color output if terminal supports it (use click.style — already have Click as dependency)

3. Update cli.py:
   - Exit code 0: all properties passed in all runs
   - Exit code 1: any property failed in any run
   - Add --threshold flag (float, 0-1, default 1.0): property passes if pass_rate >= threshold. So --threshold 0.8 means a property is OK if it passes 4/5 runs. This handles LLM non-determinism gracefully.
   - Add --thorough flag: shorthand for --runs 20 (aligned with MAESTRO methodology)

4. Write a test that runs the engine 3 times and verifies the summary statistics.

Run tests. Test the CLI manually with the examples. Commit.
```

---

## Chunk 10: pytest plugin + final polish (20 min)

**Verify by:** `pytest examples/` discovers and runs scenario YAML files as test cases

**Prompt:**

```
Read CLAUDE.md for context. Build the pytest plugin so scenarios are discovered as test cases.

1. In src/agentqa/pytest_plugin.py:
   - Register as a pytest plugin via pyproject.toml entry points (pytest11)
   - pytest_collect_file hook: collect .yaml files that contain an "agents" key as test items
   - Each scenario becomes a pytest test item named after the scenario
   - The test item's runtest() method:
     a. Loads the scenario
     b. Looks for an agents.py in the same directory
     c. Creates engine, runs simulation
     d. Asserts all properties pass at the configured threshold
   - On failure, the pytest output should show the property name, which run failed, and the evidence

2. Add to pyproject.toml:
   [project.entry-points.pytest11]
   agentqa = "agentqa.pytest_plugin"

3. Create a conftest.py in examples/ that's empty (just so pytest discovers the directory)

4. Polish:
   - Make sure `pip install -e .` still works
   - Make sure `agentqa --help` shows clean help text
   - Make sure `agentqa run --help` documents all flags
   - Add a one-line version command: `agentqa --version`
   - Clean up any TODO comments that are no longer relevant

5. Final test: run `pytest examples/ -v` and see scenarios discovered and executed.

Run all tests. Commit with message "feat: complete v0.1 week 1 — core engine, property checkers, pytest plugin".
```

---

## Chunk Order & Dependencies

```
Chunk 1 (scaffold) → Chunk 2 (models) → Chunk 3 (adapter)
                                              ↓
                                         Chunk 4 (engine)
                                              ↓
                                         Chunk 5 (YAML + CLI)
                                              ↓
                                         Chunk 6 (wire + display)
                                              ↓
                                         Chunk 7 (first property)
                                              ↓
                                         Chunk 8 (remaining properties)
                                              ↓
                                         Chunk 9 (multi-run stats)
                                              ↓
                                         Chunk 10 (pytest + polish)
```

Each chunk is independently verifiable. If Claude Code produces bad output on any chunk, you can revert that chunk without losing prior work (as long as you committed after each).

## Tips for Running These in Claude Code

1. **Start each session by telling Claude Code to read CLAUDE.md.** It should do this automatically, but say "Read CLAUDE.md first" if it doesn't.
2. **After each chunk, verify BEFORE committing.** Run the verification step listed.
3. **If a chunk fails, don't ask Claude Code to "fix it" in a long chain.** Instead: revert, re-read the chunk prompt, adjust if needed, run again fresh.
4. **Keep browser dev tools mentality:** after each chunk, run `pytest tests/ -v` to make sure nothing broke.
5. **Git commit after every passing chunk.** This is your save point.
