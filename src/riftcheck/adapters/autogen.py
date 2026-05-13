from __future__ import annotations

from riftcheck.agent import AgentUnderTest, Message, Response


class AutoGenAgent(AgentUnderTest):
    """Wraps an AutoGen (AG2) ConversableAgent as an AgentUnderTest.

    Requires ``pyautogen`` to be installed::

        pip install pyautogen

    Example::

        from autogen import ConversableAgent
        from riftcheck.adapters.autogen import AutoGenAgent

        ag_agent = ConversableAgent("planner", llm_config={...})
        wrapped = AutoGenAgent("planner", ag_agent)

    The wrapped agent receives a message via its ``receive`` method and the
    last message in its chat history is returned as the response.
    """

    def __init__(self, name: str, agent: object) -> None:
        self._name = name
        self._agent = agent
        self._state: dict = {"message_count": 0}

    @property
    def name(self) -> str:
        return self._name

    def receive(self, message: Message) -> Response:
        """Deliver the message to the AutoGen agent and get its reply."""
        try:
            from autogen import ConversableAgent  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "AutoGen is not installed. Install it with: pip install pyautogen"
            ) from exc

        sender_mock = ConversableAgent(
            name=message.sender,
            llm_config=False,
            human_input_mode="NEVER",
        )

        self._agent.receive(  # type: ignore[attr-defined]
            message=message.content,
            sender=sender_mock,
            request_reply=True,
        )

        chat_history = self._agent.chat_messages.get(sender_mock, [])  # type: ignore[attr-defined]
        if chat_history:
            reply = chat_history[-1].get("content", "")
        else:
            reply = ""

        self._state["message_count"] = self._state.get("message_count", 0) + 1
        self._state["last_message"] = message.content
        self._state["last_reply"] = reply

        return Response(content=reply)

    def get_state(self) -> dict:
        return dict(self._state)
