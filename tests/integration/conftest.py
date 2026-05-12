"""Shared fixtures for integration tests with real LLM calls."""
from __future__ import annotations

import os

import pytest


def pytest_collection_modifyitems(config, items):
    """Skip integration tests if ANTHROPIC_API_KEY is not set."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        skip = pytest.mark.skip(reason="ANTHROPIC_API_KEY not set — skipping integration tests")
        for item in items:
            item.add_marker(skip)


@pytest.fixture
def anthropic_api_key() -> str:
    """Return the Anthropic API key or skip."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        pytest.skip("ANTHROPIC_API_KEY not set")
    return key


# Models for integration tests.
# Haiku for speed/cost, Sonnet for quality checks.
CLAUDE_HAIKU = "claude-haiku-4-5-20251001"
CLAUDE_SONNET = "claude-sonnet-4-6"

# Default model for tests — Haiku is cheapest and fastest.
CLAUDE_MODEL = CLAUDE_HAIKU
