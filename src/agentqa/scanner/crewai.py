"""CrewAI framework scanner.

Detects two patterns:

Pattern 1 — Direct instantiation::

    from crewai import Agent, Crew, Task
    researcher = Agent(role="Research Analyst", goal="...", backstory="...")
    crew = Crew(agents=[researcher, writer], tasks=[...])

Pattern 2 — Decorator-based (CrewAI 0.30+)::

    from crewai.project import CrewBase, agent, task, crew

    @CrewBase
    class MyProjectCrew:
        @agent
        def researcher(self) -> Agent:
            return Agent(role="Research Analyst", ...)
"""
from __future__ import annotations

import ast
import logging
from pathlib import Path

from agentqa.scanner.base import AgentInfo, ScanResult, FrameworkScanner

logger = logging.getLogger(__name__)


class CrewAIScanner(FrameworkScanner):
    """Scans Python source files for CrewAI agent definitions."""

    @property
    def framework_name(self) -> str:
        return "crewai"

    def can_scan(self, python_files: list[Path]) -> bool:
        """Check if any file imports from crewai."""
        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "crewai" in source:
                    tree = ast.parse(source, filename=str(path))
                    if _has_crewai_import(tree):
                        return True
            except (SyntaxError, UnicodeDecodeError):
                continue
        return False

    def scan(self, python_files: list[Path]) -> ScanResult:
        """Extract all Agent() instantiations from CrewAI source files."""
        agents: list[AgentInfo] = []
        entry_file = ""
        raw_imports: list[str] = []

        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "crewai" not in source:
                    continue
                tree = ast.parse(source, filename=str(path))
            except (SyntaxError, UnicodeDecodeError):
                continue

            if not _has_crewai_import(tree):
                continue

            raw_imports.extend(_collect_import_lines(tree, "crewai"))

            # Scan for Agent() calls at module level
            found = _extract_agents_from_module(tree, str(path))
            agents.extend(found)

            # Scan for @CrewBase classes with @agent methods
            found_decorated = _extract_agents_from_crewbase(tree, str(path))
            agents.extend(found_decorated)

            # Track the file containing Crew() as the entry point
            if not entry_file and _has_crew_definition(tree):
                entry_file = str(path)

        # If we found agents but no explicit Crew(), use the first file
        if agents and not entry_file:
            entry_file = agents[0].source_file

        return ScanResult(
            framework="crewai",
            agents=agents,
            entry_file=entry_file,
            raw_imports=raw_imports,
        )


def _has_crewai_import(tree: ast.Module) -> bool:
    """Check if the AST contains any import from crewai."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.startswith("crewai"):
                    return True
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.module.startswith("crewai"):
                return True
    return False


def _collect_import_lines(tree: ast.Module, module_prefix: str) -> list[str]:
    """Collect import statement text for a given module prefix."""
    lines: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith(module_prefix):
            names = ", ".join(a.name for a in node.names)
            lines.append(f"from {node.module} import {names}")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.startswith(module_prefix):
                    lines.append(f"import {alias.name}")
    return lines


def _has_crew_definition(tree: ast.Module) -> bool:
    """Check for Crew() instantiation anywhere in the AST."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = _get_call_name(node)
            if func_name == "Crew":
                return True
    return False


def _extract_agents_from_module(tree: ast.Module, source_file: str) -> list[AgentInfo]:
    """Extract Agent() calls assigned to variables at module level."""
    agents: list[AgentInfo] = []

    for node in ast.walk(tree):
        # Match: variable = Agent(...)
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                func_name = _get_call_name(node.value)
                if func_name == "Agent":
                    info = _parse_agent_call(node.value, target.id, source_file)
                    if info:
                        agents.append(info)

    return agents


def _extract_agents_from_crewbase(tree: ast.Module, source_file: str) -> list[AgentInfo]:
    """Extract agents from @CrewBase classes with @agent-decorated methods."""
    agents: list[AgentInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue

        # Check if class has @CrewBase decorator
        has_crewbase = any(
            _get_decorator_name(d) == "CrewBase"
            for d in node.decorator_list
        )
        if not has_crewbase:
            continue

        # Find @agent-decorated methods
        for item in node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            has_agent_decorator = any(
                _get_decorator_name(d) == "agent"
                for d in item.decorator_list
            )
            if not has_agent_decorator:
                continue

            # The method name is the agent name
            method_name = item.name

            # Try to find Agent() call in the method body
            info: AgentInfo | None = None
            for stmt in ast.walk(item):
                if isinstance(stmt, ast.Call) and _get_call_name(stmt) == "Agent":
                    info = _parse_agent_call(stmt, method_name, source_file)
                    break

            if info is None:
                # Couldn't parse the Agent() call, but we know the method name
                info = AgentInfo(
                    name=method_name,
                    framework="crewai",
                    source_file=source_file,
                    variable_name=method_name,
                )
            agents.append(info)

    return agents


def _parse_agent_call(call: ast.Call, var_name: str, source_file: str) -> AgentInfo | None:
    """Parse an Agent(...) call node and extract role, goal, etc."""
    kwargs = _extract_kwargs(call)
    role = kwargs.get("role", "")
    goal = kwargs.get("goal", "")
    name = kwargs.get("name", "") or var_name
    backstory = kwargs.get("backstory", "")

    return AgentInfo(
        name=_sanitize_name(name),
        role=role or goal,
        framework="crewai",
        source_file=source_file,
        variable_name=var_name,
        extra={k: v for k, v in {"goal": goal, "backstory": backstory, "role": role}.items() if v},
    )


def _extract_kwargs(call: ast.Call) -> dict[str, str]:
    """Extract keyword arguments from a Call node, resolving string literals."""
    kwargs: dict[str, str] = {}
    for kw in call.keywords:
        if kw.arg and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
            kwargs[kw.arg] = kw.value.value
        elif kw.arg and isinstance(kw.value, ast.JoinedStr):
            # f-string — can't fully resolve, use placeholder
            kwargs[kw.arg] = f"<{kw.arg}>"
    return kwargs


def _get_call_name(node: ast.Call) -> str:
    """Get the simple function name from a Call node."""
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""


def _get_decorator_name(node: ast.expr) -> str:
    """Get the name of a decorator."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Call):
        return _get_call_name(node)
    return ""


def _sanitize_name(name: str) -> str:
    """Convert a human-readable name to a safe identifier."""
    return name.lower().replace(" ", "_").replace("-", "_")
