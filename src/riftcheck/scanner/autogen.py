"""AutoGen (AG2) framework scanner.

Detects agent instantiations and GroupChat definitions::

    from autogen import AssistantAgent, UserProxyAgent, GroupChat

    researcher = AssistantAgent(name="researcher", system_message="...")
    writer = AssistantAgent(name="writer", system_message="...")
    group_chat = GroupChat(agents=[researcher, writer], messages=[])
"""
from __future__ import annotations

import ast
import logging
from pathlib import Path

from riftcheck.scanner.base import AgentInfo, ScanResult, FrameworkScanner

logger = logging.getLogger(__name__)

# All AutoGen agent class names we recognize
_AUTOGEN_AGENT_CLASSES = {
    "AssistantAgent",
    "UserProxyAgent",
    "ConversableAgent",
    "CompressibleAgent",
    "GPTAssistantAgent",
    "RetrieveAssistantAgent",
    "RetrieveUserProxyAgent",
    "TeachableAgent",
}


class AutoGenScanner(FrameworkScanner):
    """Scans Python source files for AutoGen agent definitions."""

    @property
    def framework_name(self) -> str:
        return "autogen"

    def can_scan(self, python_files: list[Path]) -> bool:
        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "autogen" in source:
                    tree = ast.parse(source, filename=str(path))
                    if _has_autogen_import(tree):
                        return True
            except (SyntaxError, UnicodeDecodeError):
                continue
        return False

    def scan(self, python_files: list[Path]) -> ScanResult:
        agents: list[AgentInfo] = []
        entry_file = ""
        raw_imports: list[str] = []

        for path in python_files:
            try:
                source = path.read_text(encoding="utf-8", errors="ignore")
                if "autogen" not in source:
                    continue
                tree = ast.parse(source, filename=str(path))
            except (SyntaxError, UnicodeDecodeError):
                continue

            if not _has_autogen_import(tree):
                continue

            raw_imports.extend(_collect_autogen_imports(tree))

            found = _extract_agents(tree, str(path))
            agents.extend(found)

            if not entry_file and _has_groupchat(tree):
                entry_file = str(path)

        if agents and not entry_file:
            entry_file = agents[0].source_file

        return ScanResult(
            framework="autogen",
            agents=agents,
            entry_file=entry_file,
            raw_imports=raw_imports,
        )


def _has_autogen_import(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "autogen" in node.module:
            return True
        if isinstance(node, ast.Import):
            for alias in node.names:
                if "autogen" in alias.name:
                    return True
    return False


def _collect_autogen_imports(tree: ast.Module) -> list[str]:
    lines: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "autogen" in node.module:
            names = ", ".join(a.name for a in node.names)
            lines.append(f"from {node.module} import {names}")
    return lines


def _has_groupchat(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = _get_call_name(node)
            if func_name == "GroupChat":
                return True
    return False


def _extract_agents(tree: ast.Module, source_file: str) -> list[AgentInfo]:
    """Extract all AutoGen agent instantiations."""
    agents: list[AgentInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue

        target = node.targets[0]
        if not isinstance(target, ast.Name) or not isinstance(node.value, ast.Call):
            continue

        call_name = _get_call_name(node.value)
        if call_name not in _AUTOGEN_AGENT_CLASSES:
            continue

        kwargs = _extract_kwargs(node.value)
        name = kwargs.get("name", target.id)
        system_message = kwargs.get("system_message", "")

        agents.append(AgentInfo(
            name=name,
            role=system_message[:200] if system_message else "",
            framework="autogen",
            source_file=source_file,
            variable_name=target.id,
            extra={k: v for k, v in {"system_message": system_message, "class": call_name}.items() if v},
        ))

    return agents


def _extract_kwargs(call: ast.Call) -> dict[str, str]:
    kwargs: dict[str, str] = {}
    for kw in call.keywords:
        if kw.arg and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
            kwargs[kw.arg] = kw.value.value
    return kwargs


def _get_call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""
