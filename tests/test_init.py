"""Tests for `riftcheck init` — scanner, scaffold, and CLI integration.

Tests cover:
  1. Framework detection (CrewAI, LangGraph, AutoGen)
  2. AST scanning — agent extraction, topology, edge cases
  3. Scaffold generation — scenario.yaml and agents.py
  4. CLI integration — the `init` command end-to-end
  5. Real-import path — LangGraph node functions via LangGraphNodeAgent
"""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

from riftcheck.scanner.base import AgentInfo, EdgeInfo, ScanResult
from riftcheck.scanner.crewai import CrewAIScanner
from riftcheck.scanner.langgraph import LangGraphScanner
from riftcheck.scanner.autogen import AutoGenScanner
from riftcheck.scanner.detect import detect_framework, scan_project
from riftcheck.scaffold import generate_scenario_yaml, generate_agents_py


# ---------------------------------------------------------------------------
# Fixtures: mock Python source files for each framework
# ---------------------------------------------------------------------------

CREWAI_DIRECT = textwrap.dedent("""\
    from crewai import Agent, Crew, Task

    researcher = Agent(
        role="Senior Research Analyst",
        goal="Find market data",
        backstory="You are a veteran analyst.",
    )

    writer = Agent(
        role="Technical Writer",
        goal="Write executive summaries",
        backstory="You make data accessible.",
    )

    crew = Crew(agents=[researcher, writer], tasks=[], verbose=True)
""")

CREWAI_DECORATOR = textwrap.dedent("""\
    from crewai import Agent, Crew, Task, CrewBase, agent

    @CrewBase
    class ResearchCrew:
        @agent
        def researcher(self) -> Agent:
            return Agent(
                role="Senior Research Analyst",
                goal="Find market data",
                backstory="Veteran analyst.",
            )

        @agent
        def writer(self) -> Agent:
            return Agent(
                role="Technical Writer",
                goal="Write summaries",
                backstory="Makes data accessible.",
            )
""")

LANGGRAPH_BASIC = textwrap.dedent("""\
    from langgraph.graph import StateGraph, START, END
    from typing import TypedDict

    class AgentState(TypedDict):
        messages: list[str]

    def researcher_fn(state):
        return {"messages": state["messages"] + ["Research done"]}

    def writer_fn(state):
        return {"messages": state["messages"] + ["Draft written"]}

    def reviewer_fn(state):
        return {"messages": state["messages"] + ["Review complete"]}

    graph = StateGraph(AgentState)
    graph.add_node("researcher", researcher_fn)
    graph.add_node("writer", writer_fn)
    graph.add_node("reviewer", reviewer_fn)
    graph.add_edge(START, "researcher")
    graph.add_edge("researcher", "writer")
    graph.add_edge("writer", "reviewer")
    graph.add_edge("reviewer", END)
    app = graph.compile()
""")

LANGGRAPH_WITH_START = textwrap.dedent("""\
    from langgraph.graph import StateGraph, START, END

    def planner(state): return state
    def executor(state): return state

    graph = StateGraph(dict)
    graph.add_node("planner", planner)
    graph.add_node("executor", executor)
    graph.add_edge(START, "planner")
    graph.add_edge("planner", "executor")
    graph.add_edge("executor", END)
""")

AUTOGEN_BASIC = textwrap.dedent("""\
    from autogen import AssistantAgent, UserProxyAgent, GroupChat

    planner = AssistantAgent(
        name="planner",
        system_message="You plan projects.",
    )

    coder = AssistantAgent(
        name="coder",
        system_message="You write Python code.",
    )

    tester = UserProxyAgent(
        name="tester",
        system_message="You run tests.",
    )

    group_chat = GroupChat(agents=[planner, coder, tester], messages=[])
""")

NOT_AN_AGENT_FRAMEWORK = textwrap.dedent("""\
    import os
    import json

    def process_data(path):
        with open(path) as f:
            return json.load(f)
""")

EMPTY_FILE = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path: Path):
    """Helper to create a temporary project with Python files."""
    def _create(files: dict[str, str]) -> Path:
        for name, content in files.items():
            p = tmp_path / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        return tmp_path
    return _create


def _python_files(directory: Path) -> list[Path]:
    """Collect .py files like the real scanner does."""
    return sorted(directory.rglob("*.py"))


# ===========================================================================
# 1. Framework detection
# ===========================================================================

class TestDetectFramework:
    """Test auto-detection of which framework is used in a directory."""

    def test_detects_crewai(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DIRECT})
        assert detect_framework(project) == "crewai"

    def test_detects_langgraph(self, tmp_project):
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        assert detect_framework(project) == "langgraph"

    def test_detects_autogen(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        assert detect_framework(project) == "autogen"

    def test_no_framework(self, tmp_project):
        project = tmp_project({"utils.py": NOT_AN_AGENT_FRAMEWORK})
        assert detect_framework(project) is None

    def test_empty_directory(self, tmp_path):
        assert detect_framework(tmp_path) is None

    def test_empty_python_file(self, tmp_project):
        project = tmp_project({"empty.py": EMPTY_FILE})
        assert detect_framework(project) is None

    def test_crewai_priority_over_langgraph(self, tmp_project):
        """CrewAI is checked first (higher market share)."""
        project = tmp_project({
            "crew.py": CREWAI_DIRECT,
            "graph.py": LANGGRAPH_BASIC,
        })
        assert detect_framework(project) == "crewai"

    def test_ignores_venv(self, tmp_project):
        """Files inside venv/ should be excluded."""
        project = tmp_project({"venv/lib/crewai_stuff.py": CREWAI_DIRECT})
        assert detect_framework(project) is None

    def test_ignores_pycache(self, tmp_project):
        project = tmp_project({"__pycache__/crew.cpython-310.py": CREWAI_DIRECT})
        assert detect_framework(project) is None


# ===========================================================================
# 2. CrewAI scanner
# ===========================================================================

class TestCrewAIScanner:
    """Test CrewAI-specific AST scanning."""

    def test_detects_direct_agents(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DIRECT})
        scanner = CrewAIScanner()
        files = _python_files(project)
        assert scanner.can_scan(files)

        result = scanner.scan(files)
        assert result.framework == "crewai"
        assert len(result.agents) == 2

        names = [a.name for a in result.agents]
        assert "researcher" in names
        assert "writer" in names

    def test_extracts_role(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DIRECT})
        result = CrewAIScanner().scan(_python_files(project))
        researcher = next(a for a in result.agents if a.name == "researcher")
        assert researcher.role == "Senior Research Analyst"

    def test_extracts_variable_name(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DIRECT})
        result = CrewAIScanner().scan(_python_files(project))
        researcher = next(a for a in result.agents if a.name == "researcher")
        assert researcher.variable_name == "researcher"

    def test_detects_crewbase_decorator(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DECORATOR})
        scanner = CrewAIScanner()
        files = _python_files(project)
        assert scanner.can_scan(files)

        result = scanner.scan(files)
        assert len(result.agents) >= 2

    def test_entry_file_set(self, tmp_project):
        project = tmp_project({"my_crew.py": CREWAI_DIRECT})
        result = CrewAIScanner().scan(_python_files(project))
        assert "my_crew.py" in result.entry_file

    def test_no_crewai_import(self, tmp_project):
        project = tmp_project({"utils.py": NOT_AN_AGENT_FRAMEWORK})
        scanner = CrewAIScanner()
        assert not scanner.can_scan(_python_files(project))

    def test_syntax_error_skipped(self, tmp_project):
        """Files with syntax errors should be skipped, not crash."""
        project = tmp_project({
            "broken.py": "from crewai import Agent\ndef foo(:\n",
            "crew.py": CREWAI_DIRECT,
        })
        result = CrewAIScanner().scan(_python_files(project))
        assert len(result.agents) == 2  # Still finds agents in good file


# ===========================================================================
# 3. LangGraph scanner
# ===========================================================================

class TestLangGraphScanner:
    """Test LangGraph-specific AST scanning."""

    def test_detects_nodes(self, tmp_project):
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = LangGraphScanner().scan(_python_files(project))
        assert result.framework == "langgraph"
        assert len(result.agents) == 3

        names = [a.name for a in result.agents]
        assert names == ["researcher", "writer", "reviewer"]

    def test_extracts_edges(self, tmp_project):
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = LangGraphScanner().scan(_python_files(project))

        edge_pairs = [(e.source, e.target) for e in result.edges]
        assert ("researcher", "writer") in edge_pairs
        assert ("writer", "reviewer") in edge_pairs

    def test_filters_sentinel_nodes(self, tmp_project):
        """START and END should not appear as agents or edge endpoints."""
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = LangGraphScanner().scan(_python_files(project))

        agent_names = [a.name for a in result.agents]
        edge_endpoints = [e.source for e in result.edges] + [e.target for e in result.edges]

        for sentinel in ("__start__", "__end__", "START", "END"):
            assert sentinel not in agent_names
            assert sentinel not in edge_endpoints

    def test_filters_start_end_constants(self, tmp_project):
        """When START/END are imported constants, they should be filtered."""
        project = tmp_project({"graph.py": LANGGRAPH_WITH_START})
        result = LangGraphScanner().scan(_python_files(project))

        agent_names = [a.name for a in result.agents]
        assert "planner" in agent_names
        assert "executor" in agent_names
        assert "START" not in agent_names
        assert "END" not in agent_names

    def test_extracts_handler_variable_name(self, tmp_project):
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = LangGraphScanner().scan(_python_files(project))
        researcher = next(a for a in result.agents if a.name == "researcher")
        assert researcher.variable_name == "researcher_fn"

    def test_entry_file_set(self, tmp_project):
        project = tmp_project({"pipeline.py": LANGGRAPH_BASIC})
        result = LangGraphScanner().scan(_python_files(project))
        assert "pipeline.py" in result.entry_file


# ===========================================================================
# 4. AutoGen scanner
# ===========================================================================

class TestAutoGenScanner:
    """Test AutoGen-specific AST scanning."""

    def test_detects_agents(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = AutoGenScanner().scan(_python_files(project))
        assert result.framework == "autogen"
        assert len(result.agents) == 3

    def test_extracts_name_from_kwarg(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = AutoGenScanner().scan(_python_files(project))
        names = [a.name for a in result.agents]
        assert "planner" in names
        assert "coder" in names
        assert "tester" in names

    def test_extracts_system_message(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = AutoGenScanner().scan(_python_files(project))
        planner = next(a for a in result.agents if a.name == "planner")
        assert "plan" in planner.role.lower()

    def test_extracts_variable_name(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = AutoGenScanner().scan(_python_files(project))
        planner = next(a for a in result.agents if a.name == "planner")
        assert planner.variable_name == "planner"

    def test_detects_groupchat_entry(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = AutoGenScanner().scan(_python_files(project))
        assert "team.py" in result.entry_file

    def test_recognizes_all_agent_classes(self, tmp_project):
        """All known AutoGen agent classes should be detected."""
        source = textwrap.dedent("""\
            from autogen import AssistantAgent, UserProxyAgent, ConversableAgent

            a = AssistantAgent(name="assistant", system_message="Help")
            b = UserProxyAgent(name="proxy", system_message="Execute")
            c = ConversableAgent(name="generic", system_message="Chat")
        """)
        project = tmp_project({"agents.py": source})
        result = AutoGenScanner().scan(_python_files(project))
        assert len(result.agents) == 3


# ===========================================================================
# 5. Scaffold generation — scenario.yaml
# ===========================================================================

class TestScenarioYaml:
    """Test generated scenario.yaml content and structure."""

    def _make_result(self, n_agents: int = 2, edges: bool = False) -> ScanResult:
        agents = [
            AgentInfo(name=f"agent_{i}", role=f"Role {i}", framework="crewai",
                      source_file="crew.py", variable_name=f"agent_{i}")
            for i in range(n_agents)
        ]
        edge_list = [EdgeInfo(source="agent_0", target="agent_1")] if edges and n_agents >= 2 else []
        return ScanResult(framework="crewai", agents=agents, edges=edge_list, entry_file="crew.py")

    def test_generates_valid_yaml(self, tmp_path):
        result = self._make_result(2)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assert content is not None
        assert "name" in content
        assert "agents" in content
        assert "assertions" in content

    def test_agent_count_matches(self, tmp_path):
        result = self._make_result(3)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assert len(content["agents"]) == 3

    def test_always_includes_core_assertions(self, tmp_path):
        result = self._make_result(2)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "no_deadlock" in assertion_names
        assert "converges_within" in assertion_names
        assert "no_information_leak" in assertion_names

    def test_step_repetition_for_3plus_agents(self, tmp_path):
        result = self._make_result(3)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "step_repetition" in assertion_names

    def test_no_step_repetition_for_2_agents(self, tmp_path):
        result = self._make_result(2)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "step_repetition" not in assertion_names

    def test_information_flow_with_edges(self, tmp_path):
        result = self._make_result(2, edges=True)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "ensures_information_flow" in assertion_names

    def test_no_information_flow_without_edges(self, tmp_path):
        result = self._make_result(2, edges=False)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "ensures_information_flow" not in assertion_names

    def test_communication_quality_for_2plus(self, tmp_path):
        result = self._make_result(2)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assertion_names = [a["name"] for a in content["assertions"]]
        assert "communication_quality" in assertion_names

    def test_turns_scale_with_agents(self, tmp_path):
        result = self._make_result(5)
        path = generate_scenario_yaml(result, tmp_path)
        content = yaml.safe_load(path.read_text())
        assert content["turns"] >= 20  # max(5*4, 12)

    def test_output_file_name(self, tmp_path):
        result = self._make_result(2)
        path = generate_scenario_yaml(result, tmp_path)
        assert path.name == "scenario.yaml"


# ===========================================================================
# 6. Scaffold generation — agents.py
# ===========================================================================

class TestAgentsPy:
    """Test generated agents.py content and structure."""

    def _make_crewai_result(self) -> ScanResult:
        return ScanResult(
            framework="crewai",
            agents=[
                AgentInfo(name="researcher", role="Analyst", framework="crewai",
                          source_file="crew.py", variable_name="researcher"),
                AgentInfo(name="writer", role="Writer", framework="crewai",
                          source_file="crew.py", variable_name="writer"),
            ],
            entry_file="crew.py",
        )

    def _make_langgraph_result(self) -> ScanResult:
        return ScanResult(
            framework="langgraph",
            agents=[
                AgentInfo(name="researcher", role="", framework="langgraph",
                          source_file="graph.py", variable_name="researcher_fn"),
                AgentInfo(name="writer", role="", framework="langgraph",
                          source_file="graph.py", variable_name="writer_fn"),
            ],
            edges=[EdgeInfo(source="researcher", target="writer")],
            entry_file="graph.py",
        )

    def _make_autogen_result(self) -> ScanResult:
        return ScanResult(
            framework="autogen",
            agents=[
                AgentInfo(name="planner", role="Plans tasks", framework="autogen",
                          source_file="team.py", variable_name="planner"),
                AgentInfo(name="coder", role="Writes code", framework="autogen",
                          source_file="team.py", variable_name="coder"),
            ],
            entry_file="team.py",
        )

    def test_crewai_imports_real_agents(self, tmp_path):
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "from riftcheck.adapters.crewai import CrewAIAgent" in content
        assert "from crew import researcher, writer" in content
        assert 'CrewAIAgent("researcher", researcher)' in content

    def test_langgraph_uses_node_agent(self, tmp_path):
        result = self._make_langgraph_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "from riftcheck.adapters.langgraph import LangGraphNodeAgent" in content
        assert "importlib.util.spec_from_file_location" in content
        assert "exec_module(_mod)" in content
        assert 'LangGraphNodeAgent("researcher", getattr(_mod, "researcher_fn"))' in content
        assert 'LangGraphNodeAgent("writer", getattr(_mod, "writer_fn"))' in content

    def test_langgraph_generated_agents_survive_failed_graph_compile(self, tmp_path):
        """If graph.compile() raises (e.g. missing START), node fns must still load."""
        pytest.importorskip("langgraph")
        graph_broken = textwrap.dedent("""\
            from langgraph.graph import StateGraph, END
            from typing import TypedDict

            class AgentState(TypedDict):
                messages: list[str]

            def researcher_fn(state):
                return {"messages": state.get("messages", [])}

            def writer_fn(state):
                return {"messages": state.get("messages", [])}

            graph = StateGraph(AgentState)
            graph.add_node("researcher", researcher_fn)
            graph.add_node("writer", writer_fn)
            graph.add_edge("researcher", "writer")
            graph.add_edge("writer", END)
            app = graph.compile()
        """)
        (tmp_path / "graph.py").write_text(graph_broken, encoding="utf-8")

        result = self._make_langgraph_result()
        agents_path = generate_agents_py(result, tmp_path)

        import importlib.util
        import sys

        sys.path.insert(0, str(tmp_path))
        try:
            spec = importlib.util.spec_from_file_location("_riftcheck_broken_graph", agents_path)
            assert spec is not None and spec.loader is not None
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            agents = mod.agents
            from riftcheck.adapters.langgraph import LangGraphNodeAgent

            assert isinstance(agents["researcher"], LangGraphNodeAgent)
            assert isinstance(agents["writer"], LangGraphNodeAgent)
        finally:
            sys.path.remove(str(tmp_path))

    def test_autogen_imports_real_agents(self, tmp_path):
        result = self._make_autogen_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "from riftcheck.adapters.autogen import AutoGenAgent" in content
        assert "from team import planner, coder" in content
        assert 'AutoGenAgent("planner", planner)' in content

    def test_has_use_real_agents_flag(self, tmp_path):
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "USE_REAL_AGENTS = True" in content

    def test_has_fallback_handlers(self, tmp_path):
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "if not USE_REAL_AGENTS:" in content
        assert "from riftcheck.adapters.raw import RawAgent" in content
        assert "_researcher_handler" in content
        assert "_writer_handler" in content

    def test_fallback_has_convergence_message(self, tmp_path):
        """Last agent's handler should produce a convergence message."""
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "All tasks completed" in content
        assert "agreed" in content.lower()

    def test_fallback_pip_install_hint(self, tmp_path):
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "pip install crewai" in content

    def test_autogen_pip_name(self, tmp_path):
        result = self._make_autogen_result()
        path = generate_agents_py(result, tmp_path)
        content = path.read_text()
        assert "pip install pyautogen" in content

    def test_output_file_name(self, tmp_path):
        result = self._make_crewai_result()
        path = generate_agents_py(result, tmp_path)
        assert path.name == "agents.py"

    def test_generated_agents_py_is_valid_python(self, tmp_path):
        """The generated file must be parseable as Python."""
        import ast as ast_module
        for make_result in [self._make_crewai_result, self._make_langgraph_result, self._make_autogen_result]:
            result = make_result()
            out = tmp_path / result.framework
            out.mkdir(exist_ok=True)
            path = generate_agents_py(result, out)
            # This will raise SyntaxError if the generated code is invalid
            ast_module.parse(path.read_text())


# ===========================================================================
# 7. Full scan_project integration
# ===========================================================================

class TestScanProject:
    """Test the scan_project orchestration function."""

    def test_crewai_end_to_end(self, tmp_project):
        project = tmp_project({"crew.py": CREWAI_DIRECT})
        result = scan_project(project)
        assert result is not None
        assert result.framework == "crewai"
        assert len(result.agents) >= 2

    def test_langgraph_end_to_end(self, tmp_project):
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = scan_project(project)
        assert result is not None
        assert result.framework == "langgraph"
        assert len(result.agents) == 3
        assert len(result.edges) == 2

    def test_autogen_end_to_end(self, tmp_project):
        project = tmp_project({"team.py": AUTOGEN_BASIC})
        result = scan_project(project)
        assert result is not None
        assert result.framework == "autogen"
        assert len(result.agents) == 3

    def test_force_framework(self, tmp_project):
        """When --framework is specified, use that scanner even if another matches."""
        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        result = scan_project(project, framework="langgraph")
        assert result is not None
        assert result.framework == "langgraph"

    def test_no_agents_returns_none(self, tmp_project):
        project = tmp_project({"utils.py": NOT_AN_AGENT_FRAMEWORK})
        assert scan_project(project) is None


# ===========================================================================
# 8. CLI integration
# ===========================================================================

class TestInitCLI:
    """Test the `riftcheck init` CLI command."""

    def test_init_creates_files(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"crew.py": CREWAI_DIRECT})
        runner = CliRunner()
        result = runner.invoke(main, ["init", str(project)])

        assert result.exit_code == 0
        assert (project / "scenario.yaml").exists()
        assert (project / "agents.py").exists()

    def test_init_refuses_overwrite(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"crew.py": CREWAI_DIRECT})
        # First init
        runner = CliRunner()
        runner.invoke(main, ["init", str(project)])
        # Second init should fail
        result = runner.invoke(main, ["init", str(project)])
        assert result.exit_code != 0
        assert "already exist" in result.output

    def test_init_force_overwrites(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"crew.py": CREWAI_DIRECT})
        runner = CliRunner()
        runner.invoke(main, ["init", str(project)])
        result = runner.invoke(main, ["init", str(project), "--force"])
        assert result.exit_code == 0

    def test_init_output_directory(self, tmp_project, tmp_path):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"crew.py": CREWAI_DIRECT})
        out_dir = tmp_path / "output"
        out_dir.mkdir()
        runner = CliRunner()
        result = runner.invoke(main, ["init", str(project), "-o", str(out_dir)])

        assert result.exit_code == 0
        assert (out_dir / "scenario.yaml").exists()
        assert (out_dir / "agents.py").exists()

    def test_init_no_framework_fails(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"utils.py": NOT_AN_AGENT_FRAMEWORK})
        runner = CliRunner()
        result = runner.invoke(main, ["init", str(project)])
        assert result.exit_code != 0
        assert "No multi-agent framework detected" in result.output

    def test_init_reports_agents(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"crew.py": CREWAI_DIRECT})
        runner = CliRunner()
        result = runner.invoke(main, ["init", str(project)])
        assert "researcher" in result.output
        assert "writer" in result.output

    def test_init_reports_topology(self, tmp_project):
        from click.testing import CliRunner
        from riftcheck.cli import main

        project = tmp_project({"graph.py": LANGGRAPH_BASIC})
        runner = CliRunner()
        result = runner.invoke(main, ["init", str(project)])
        assert "Topology" in result.output
        assert "researcher" in result.output


# ===========================================================================
# 9. LangGraphNodeAgent adapter
# ===========================================================================

class TestLangGraphNodeAgent:
    """Test the LangGraphNodeAgent adapter with real node functions."""

    def test_basic_invocation(self):
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.agent import Message

        def node_fn(state):
            return {"messages": state.get("messages", []) + ["Hello from node"]}

        agent = LangGraphNodeAgent("test_node", node_fn)
        msg = Message(sender="engine", receiver="test_node", content="Go", turn=0)
        resp = agent.receive(msg)

        assert resp.content == "Hello from node"
        assert len(resp.content) > 0

    def test_state_accumulates(self):
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.agent import Message

        def node_fn(state):
            msgs = state.get("messages", [])
            return {"messages": msgs + [f"Step {len(msgs)}"], "count": len(msgs)}

        agent = LangGraphNodeAgent("counter", node_fn)

        for i in range(3):
            msg = Message(sender="engine", receiver="counter", content=f"Turn {i}", turn=i)
            resp = agent.receive(msg)

        state = agent.get_state()
        # Messages include both incoming + generated
        assert state["count"] >= 2

    def test_setup_resets_state(self):
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.agent import Message

        def node_fn(state):
            return {"messages": state.get("messages", []) + ["Done"], "step": 1}

        agent = LangGraphNodeAgent("resettable", node_fn)
        msg = Message(sender="engine", receiver="resettable", content="Go", turn=0)
        agent.receive(msg)
        assert agent.get_state().get("step") == 1

        agent.setup()
        assert agent.get_state() == {}

    def test_string_return(self):
        """Node functions that return strings should work too."""
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.agent import Message

        def simple_node(state):
            return "Just a string response"

        agent = LangGraphNodeAgent("simple", simple_node)
        msg = Message(sender="engine", receiver="simple", content="Go", turn=0)
        resp = agent.receive(msg)
        assert resp.content == "Just a string response"

    def test_non_empty_responses(self):
        """The key bug: node functions must produce non-empty responses."""
        from riftcheck.adapters.langgraph import LangGraphNodeAgent
        from riftcheck.agent import Message

        def real_node(state):
            return {
                "messages": state.get("messages", []) + ["Analysis complete"],
                "current_step": "analysis",
            }

        agent = LangGraphNodeAgent("analyst", real_node)
        msg = Message(sender="engine", receiver="analyst", content="Analyze this", turn=0)
        resp = agent.receive(msg)

        # This is what the old RawAgent would have returned: empty string
        # LangGraphNodeAgent should return the actual message
        assert resp.content != ""
        assert "Analysis complete" in resp.content


# ===========================================================================
# 10. End-to-end: init → run with real node functions
# ===========================================================================

class TestInitToRun:
    """Test the full pipeline: scan → scaffold → run with real functions."""

    def test_langgraph_real_functions(self, tmp_path):
        """Create a LangGraph project with importable node functions,
        run init, then run the scenario with real agents."""
        from riftcheck.engine import SimulationEngine
        from riftcheck.scenario import load_scenario

        # Write a LangGraph project with importable functions
        source = textwrap.dedent("""\
            from typing import TypedDict

            class AgentState(TypedDict):
                messages: list[str]

            def researcher_fn(state):
                msgs = state.get("messages", [])
                return {"messages": msgs + ["Research findings on AI market trends."]}

            def writer_fn(state):
                msgs = state.get("messages", [])
                return {"messages": msgs + ["Executive summary drafted. Agreed."]}

            # Graph construction guarded — functions importable without langgraph
            try:
                from langgraph.graph import StateGraph, START, END
                graph = StateGraph(AgentState)
                graph.add_node("researcher", researcher_fn)
                graph.add_node("writer", writer_fn)
                graph.add_edge(START, "researcher")
                graph.add_edge("researcher", "writer")
                graph.add_edge("writer", END)
                app = graph.compile()
            except ImportError:
                pass
        """)
        (tmp_path / "graph.py").write_text(source)

        # Scan and scaffold
        result = scan_project(tmp_path, framework="langgraph")
        assert result is not None

        generate_scenario_yaml(result, tmp_path)
        generate_agents_py(result, tmp_path)

        # Load the generated agents.py
        import importlib.util
        import sys

        # Add tmp_path to sys.path for any relative imports in agents.py
        sys.path.insert(0, str(tmp_path))
        try:
            spec = importlib.util.spec_from_file_location("_test_agents", tmp_path / "agents.py")
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)

            agents = mod.agents
            assert len(agents) == 2
            assert "researcher" in agents
            assert "writer" in agents

            # Verify these are LangGraphNodeAgent, not RawAgent fallbacks
            from riftcheck.adapters.langgraph import LangGraphNodeAgent
            assert isinstance(agents["researcher"], LangGraphNodeAgent)
            assert isinstance(agents["writer"], LangGraphNodeAgent)

            # Run the scenario
            scenario = load_scenario(tmp_path / "scenario.yaml")
            agent_list = [agents[a.name] for a in scenario.agents if a.name in agents]
            engine = SimulationEngine(agent_list, scenario)
            traces = engine.run()

            # Verify we got real output, not empty strings
            assert len(traces) > 0
            for trace in traces:
                messages = [e for e in trace.events if e.type == "message"]
                for msg in messages:
                    content = msg.data.get("content", "")
                    assert content != "", f"Empty message at turn {msg.turn} from {msg.agent}"

        finally:
            sys.path.remove(str(tmp_path))
