# Integration Tests — Real LLM Calls

These tests verify that AgentQA adapters work with **real framework agents making real LLM calls**.
They are NOT run in CI — they require API keys and cost money.

## Setup

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Install frameworks (any or all)
pip install crewai                       # CrewAI adapter
pip install langchain-anthropic langgraph # LangGraph adapter
pip install "ag2[anthropic]"             # AutoGen/AG2 adapter

# Run all integration tests
python -m pytest tests/integration/ -v -s

# Run one framework at a time
python -m pytest tests/integration/test_crewai_real.py -v -s
python -m pytest tests/integration/test_langgraph_real.py -v -s
python -m pytest tests/integration/test_autogen_real.py -v -s
```

## Models

Tests default to `claude-haiku-4-5-20251001` (fastest, cheapest).
Edit `conftest.py` to switch to `claude-sonnet-4-6` for higher-quality checks.

Each test makes 1-4 LLM calls. Full suite costs ~$0.01-0.03 with Haiku.

## Known issues

- **CrewAI + Claude 4.6**: CrewAI uses assistant message prefilling, which Claude 4.6
  models reject with a 400 error ([crewAI#4798](https://github.com/crewAIInc/crewAI/issues/4798)).
  Tests use Haiku 4.5 to avoid this. If CrewAI ships a fix, switch to Sonnet 4.6.
- Tests skip automatically if `ANTHROPIC_API_KEY` is not set or the framework isn't installed.
- Regular `pytest tests/` does NOT collect these — they only run when explicitly targeted.
