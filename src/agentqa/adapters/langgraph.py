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


class LangGraphNodeAgent(AgentUnderTest):
    """Wraps a single LangGraph node function as an AgentUnderTest.

    LangGraph node functions have the signature::

        def my_node(state: AgentState) -> AgentState

    where AgentState is typically a TypedDict with a ``messages`` key.
    This adapter bridges between AgentQA's message-based interface and
    LangGraph's state-dict interface.

    Example::

        from agentqa.adapters.langgraph import LangGraphNodeAgent

        def researcher_fn(state):
            return {"messages": state["messages"] + ["Done"], "step": "research"}

        wrapped = LangGraphNodeAgent("researcher", researcher_fn)

    The adapter:
      1. Builds an AgentState dict from the incoming message
      2. Calls the node function with it
      3. Extracts a response string from the returned state

    Args:
        name: Agent name for AgentQA.
        node_fn: The LangGraph node function.
        messages_key: Key in the state dict holding the message list.
            Defaults to ``"messages"``.
    """

    def __init__(
        self,
        name: str,
        node_fn: Callable,
        messages_key: str = "messages",
    ) -> None:
        self._name = name
        self._node_fn = node_fn
        self._messages_key = messages_key
        self._state: dict = {}
        self._message_history: list[str] = []

    @property
    def name(self) -> str:
        return self._name

    def receive(self, message: Message) -> Response:
        """Invoke the node function with an AgentState built from the message."""
        self._message_history.append(message.content)

        # Build a state dict that looks like what the node expects
        input_state = {
            self._messages_key: list(self._message_history),
            **self._state,
        }

        result = self._node_fn(input_state)

        # Extract response from the node's return value
        if isinstance(result, dict):
            self._state.update(result)

            # Try to get the latest message from the messages list
            messages = result.get(self._messages_key, [])
            if isinstance(messages, list) and messages:
                output = str(messages[-1])
            else:
                # Fall back to stringifying the whole state (minus messages)
                non_msg = {k: v for k, v in result.items() if k != self._messages_key}
                output = str(non_msg) if non_msg else str(result)
        elif isinstance(result, str):
            output = result
        else:
            output = str(result)

        return Response(content=output)

    def setup(self) -> None:
        """Reset state between runs."""
        self._state = {}
        self._message_history = []

    def get_state(self) -> dict:
        return dict(self._state)
