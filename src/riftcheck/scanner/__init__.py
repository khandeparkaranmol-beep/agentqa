"""Framework scanners for auto-detecting multi-agent code in user projects.

Each scanner parses Python source files (via AST) and extracts agent
definitions for a specific framework. The results are used by ``riftcheck init``
to generate starter scenario YAML and agents.py scaffolds.
"""
from __future__ import annotations

from riftcheck.scanner.base import AgentInfo, ScanResult, FrameworkScanner
from riftcheck.scanner.detect import detect_framework, scan_project
from riftcheck.scanner.crewai import CrewAIScanner
from riftcheck.scanner.langgraph import LangGraphScanner
from riftcheck.scanner.autogen import AutoGenScanner

__all__ = [
    "AgentInfo",
    "ScanResult",
    "FrameworkScanner",
    "CrewAIScanner",
    "LangGraphScanner",
    "AutoGenScanner",
    "detect_framework",
    "scan_project",
]
