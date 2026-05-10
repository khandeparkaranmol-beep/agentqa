from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from agentqa.agent import AgentUnderTest, Message, Response

if TYPE_CHECKING:
    pass


class LangGraphAgent(AgentUnderTest):
    """Wraps a LangGraph compiled graph as an AgentUnderTest.

    Requires ``langgraph`` to be installed::

        pip install langgraph

    Example::

        from langgraph.graph import StateGraph
        from agentqa.adapters.langgraph import LangGraphAgent

        # Build and compile your graph
        graph = StateGraph(...).compile()
        wrapped = LangGraphAgent("planner", graph, input_key="messages")

    The graph is invoked with ``{input_key: message.content}``.
    The response is extracted from the graph's output using ``output_key``
    (default: same as ``input_key``).
    """

    def __init__(
        self,
        name: str,
        graph: object,
        input_key: str = "messages",
        output_key: str | None = None,
        initial_state: dict | None = None,
    ) -> None:
        self._name = name
        self._graph = graph
        self._input_key = input_key
        self._output_key = output_key or input_key
        self._state: dict = dict(initial_state) if initial_state else {}

    @property
    def name(self) -> str:
        return self._name

    def receive(self, message: Message) -> Response:
        """Invoke the LangGraph graph with the message content."""
        try:
            import langgraph  # type: ignore[import]  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "LangGraph is not installed. Install it with: pip install langgraph"
            ) from exc

        inputs = {self._input_key: message.content}
        result = self._graph.invoke(inputs)  # type: ignore[attr-defined]

        if isinstance(result, dict):
            output = result.get(self._output_key, "")
            if isinstance(output, list) and output:
                output = str(output[-1])
            else:
                output = str(output)
            self._state.update(result)
        else:
            output = str(result)

        return Response(content=output)

    def get_state(self) -> dict:
        return dict(self._state)
