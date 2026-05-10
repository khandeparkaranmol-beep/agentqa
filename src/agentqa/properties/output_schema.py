from __future__ import annotations

import json

from agentqa.properties.base import PropertyChecker, PropertyResult, registry
from agentqa.scenario import ScenarioConfig
from agentqa.trace import Trace


class OutputSchemaChecker(PropertyChecker):
    """Check that the final message can be parsed as JSON and matches a schema.

    params:
        schema (dict): a JSON Schema object to validate against.
    """

    @property
    def name(self) -> str:
        return "output_schema"

    def check(self, trace: Trace, scenario: ScenarioConfig, params: dict) -> PropertyResult:
        schema: dict = params.get("schema", {})
        messages = trace.get_messages()

        if not messages:
            return PropertyResult(
                property_name=self.name,
                passed=False,
                details="Trace contains no messages; cannot check output schema.",
            )

        last_event = messages[-1]
        content: str = last_event.data.get("content", "")

        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            return PropertyResult(
                property_name=self.name,
                passed=False,
                details=f"Final output is not valid JSON: '{content[:100]}'",
                evidence=[last_event],
                turn=last_event.turn,
            )

        if schema:
            error = self._validate_schema(parsed, schema)
            if error:
                return PropertyResult(
                    property_name=self.name,
                    passed=False,
                    details=f"Final output failed schema validation: {error}",
                    evidence=[last_event],
                    turn=last_event.turn,
                )

        return PropertyResult(
            property_name=self.name,
            passed=True,
            details="Final output is valid JSON and matches the schema.",
        )

    @staticmethod
    def _validate_schema(data: object, schema: dict) -> str | None:
        """Minimal JSON Schema validation (type + required fields only).

        Returns an error message string or None if valid.
        """
        expected_type = schema.get("type")
        if expected_type:
            type_map: dict[str, type | tuple[type, ...]] = {
                "object": dict,
                "array": list,
                "string": str,
                "number": (int, float),
                "integer": int,
                "boolean": bool,
                "null": type(None),
            }
            py_type = type_map.get(expected_type)
            if py_type and not isinstance(data, py_type):
                return f"expected type '{expected_type}', got '{type(data).__name__}'"

        if expected_type == "object" and isinstance(data, dict):
            props: dict = schema.get("properties", {})
            required: list[str] = schema.get("required", [])

            for field in required:
                if field not in data:
                    return f"required field '{field}' is missing"

            for field, field_schema in props.items():
                if field in data:
                    sub_error = OutputSchemaChecker._validate_schema(data[field], field_schema)
                    if sub_error:
                        return f"field '{field}': {sub_error}"

        return None


registry.register(OutputSchemaChecker())
