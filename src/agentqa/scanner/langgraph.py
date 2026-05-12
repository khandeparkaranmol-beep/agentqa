"""LangGraph framework scanner.

Detects StateGraph definitions and extracts topology from add_node/add_edge calls::

    from langgraph.graph import StateGraph

    graph = StateGraph(AgentState)
    graph.add_node("researcher", researcher_fn)
    graph.add_node("writer", writer_fn)
    graph.add_edge("researcher", "writer")
    compiled = graph.compile()
"""
from __future__ import annotations

import ast
import logging
from pathlib import Path

from agentqa.scanner.base import AgentInfo, EdgeInfo, ScanResult, FrameworkScanner

logger = logging.getLogger(__name__)


class LangGraphScanner(FrameworkScanner):
    """Scans Python source files for LangGraph graph definitions."""

    @property
    def framework_name(self) -> str:
        return "langgraph"

    def can_scan(self, python_files: list[Path]) -> bool:
        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "langgraph" in source:
                    tree = ast.parse(source, filename=str(path))
                    if _has_langgraph_import(tree):
                        return True
            except (SyntaxError, UnicodeDecodeError):
                continue
        return False

    def scan(self, python_files: list[Path]) -> ScanResult:
        agents: list[AgentInfo] = []
        edges: list[EdgeInfo] = []
        entry_file = ""
        raw_imports: list[str] = []

        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "langgraph" not in source:
                    continue
                tree = ast.parse(source, filename=str(path))
            except (SyntaxError, UnicodeDecodeError):
                continue

            if not _has_langgraph_import(tree):
                continue

            raw_imports.extend(_collect_langgraph_imports(tree))

            # Find graph variable names (x = StateGraph(...))
            graph_vars = _find_graph_variables(tree)
            if graph_vars and not entry_file:
                entry_file = str(path)

            # Extract add_node calls → agents
            nodes = _extract_nodes(tree, graph_vars, str(path))
            agents.extend(nodes)

            # Extract add_edge calls → topology
            found_edges = _extract_edges(tree, graph_vars)
            edges.extend(found_edges)

        if agents and not entry_file:
            entry_file = agents[0].source_file

        return ScanResult(
            framework="langgraph",
            agents=agents,
            edges=edges,
            entry_file=entry_file,
            raw_imports=raw_imports,
        )


def _has_langgraph_import(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "langgraph" in node.module:
            return True
        if isinstance(node, ast.Import):
            for alias in node.names:
                if "langgraph" in alias.name:
                    return True
    return False


def _collect_langgraph_imports(tree: ast.Module) -> list[str]:
    lines: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "langgraph" in node.module:
            names = ", ".join(a.name for a in node.names)
            lines.append(f"from {node.module} import {names}")
    return lines


def _find_graph_variables(tree: ast.Module) -> set[str]:
    """Find variable names assigned to StateGraph(...)."""
    graph_vars: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and isinstance(node.value, ast.Call):
                call_name = _get_call_name(node.value)
                if call_name == "StateGraph":
                    graph_vars.add(target.id)
    return graph_vars


def _extract_nodes(tree: ast.Module, graph_vars: set[str], source_file: str) -> list[AgentInfo]:
    """Extract add_node("name", fn) calls on graph variables."""
    agents: list[AgentInfo] = []
    seen_names: set[str] = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        # Match graph.add_node(...)
        if not (isinstance(node.func, ast.Attribute) and node.func.attr == "add_node"):
            continue

        # Verify the object is a known graph variable
        if isinstance(node.func.value, ast.Name) and node.func.value.id not in graph_vars:
            continue

        # First positional arg is the node name
        if not node.args:
            continue

        first_arg = node.args[0]
        if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
            node_name = first_arg.value
        elif isinstance(first_arg, ast.Name):
            node_name = first_arg.id
        else:
            continue

        if node_name in seen_names:
            continue
        seen_names.add(node_name)

        # Second arg might be the handler function — use as variable_name
        var_name = ""
        if len(node.args) >= 2 and isinstance(node.args[1], ast.Name):
            var_name = node.args[1].id

        agents.append(AgentInfo(
            name=node_name,
            role="",
            framework="langgraph",
            source_file=source_file,
            variable_name=var_name or node_name,
        ))

    return agents


def _extract_edges(tree: ast.Module, graph_vars: set[str]) -> list[EdgeInfo]:
    """Extract add_edge("source", "target") calls."""
    edges: list[EdgeInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        if not (isinstance(node.func, ast.Attribute) and node.func.attr == "add_edge"):
            continue

        if isinstance(node.func.value, ast.Name) and node.func.value.id not in graph_vars:
            continue

        if len(node.args) < 2:
            continue

        src = _str_from_node(node.args[0])
        tgt = _str_from_node(node.args[1])

        # Filter out LangGraph sentinel nodes (START/END in various forms)
        sentinels = {"__start__", "__end__", "START", "END"}
        if src and tgt and src not in sentinels and tgt not in sentinels:
            edges.append(EdgeInfo(source=src, target=tgt))

    return edges


def _str_from_node(node: ast.expr) -> str:
    """Extract a string value from a Constant or Name node."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name):
        return node.id
    return ""


def _get_call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""
