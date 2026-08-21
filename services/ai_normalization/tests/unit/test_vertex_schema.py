from services.ai_normalization.pipeline.extraction import _vertex_response_schema


def test_vertex_schema_uses_openapi_types_and_nullable():
    schema = _vertex_response_schema({
        "title": "Example",
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "note": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": None},
        },
    })
    assert schema["type"] == "OBJECT"
    assert schema["properties"]["name"]["type"] == "STRING"
    assert schema["properties"]["note"] == {"type": "STRING", "nullable": True}
    assert "title" not in schema
