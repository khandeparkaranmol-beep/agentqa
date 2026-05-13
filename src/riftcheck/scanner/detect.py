"""Framework detection and project scanning orchestration."""
from __future__ import annotations

import logging
from pathlib import Path

from riftcheck.scanner.base import ScanResult, FrameworkScanner
from riftcheck.scanner.crewai import CrewAIScanner
from riftcheck.scanner.langgraph import LangGraphScanner
from riftcheck.scanner.autogen import AutoGenScanner

logger = logging.getLogger(__name__)

# Ordered by market share / priority
_SCANNERS: list[FrameworkScanner] = [
    CrewAIScanner(),
    LangGraphScanner(),
    AutoGenScanner(),
]


def detect_framework(directory: Path) -> str | None:
    """Detect which multi-agent framework is used in a directory.

    Returns the framework name ('crewai', 'langgraph', 'autogen') or None.
    Scans Python files for framework-specific imports.
    """
    python_files = _collect_python_files(directory)
    if not python_files:
        return None

    for scanner in _SCANNERS:
        if scanner.can_scan(python_files):
            logger.debug("Detected framework: %s", scanner.framework_name)
            return scanner.framework_name

    return None


def scan_project(directory: Path, framework: str | None = None) -> ScanResult | None:
    """Scan a project directory and extract agent definitions.

    Args:
        directory: Root directory to scan.
        framework: If provided, use this specific scanner. If None,
                   auto-detect the framework.

    Returns:
        A ScanResult with discovered agents and topology, or None if
        no framework was detected or no agents were found.
    """
    python_files = _collect_python_files(directory)
    if not python_files:
        logger.debug("No Python files found in %s", directory)
        return None

    # Use specified framework or auto-detect
    scanner: FrameworkScanner | None = None
    if framework:
        for s in _SCANNERS:
            if s.framework_name == framework:
                scanner = s
                break
    else:
        for s in _SCANNERS:
            if s.can_scan(python_files):
                scanner = s
                break

    if scanner is None:
        logger.debug("No supported framework detected in %s", directory)
        return None

    result = scanner.scan(python_files)

    if not result.agents:
        logger.debug("Framework %s detected but no agents found", scanner.framework_name)
        return None

    return result


def _collect_python_files(directory: Path) -> list[Path]:
    """Collect all .py files, excluding common non-source directories."""
    exclude = {
        "__pycache__", ".git", ".venv", "venv", "env", "node_modules",
        ".tox", ".eggs", "dist", "build", ".riftcheck",
    }

    files: list[Path] = []
    for path in directory.rglob("*.py"):
        # Skip excluded directories
        if any(part in exclude for part in path.parts):
            continue
        files.append(path)

    return sorted(files)
