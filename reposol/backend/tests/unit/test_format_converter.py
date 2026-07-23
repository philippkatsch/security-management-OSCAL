"""
Unit tests for app/format_converter.py covering:
- XML to Python dict and back
- YAML to Python dict and back
- Error cases for malformed inputs
"""
import pytest
from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    serialize_dict_to_yaml
)

class TestFormatConverter:
    def test_xml_to_dict_and_back(self):
        xml_input = """<?xml version="1.0" encoding="utf-8"?>
<catalog xmlns="http://csrc.nist.gov/ns/oscal/1.0" uuid="00000000-0000-0000-0000-000000000000">
  <metadata>
    <title>Test Catalog</title>
    <last-modified>2026-07-19T10:00:00Z</last-modified>
    <version>1.0.0</version>
    <oscal-version>1.1.2</oscal-version>
  </metadata>
</catalog>
"""
        parsed = parse_xml_to_oscal_dict(xml_input)
        assert parsed["catalog"]["uuid"] == "00000000-0000-0000-0000-000000000000"
        assert parsed["catalog"]["metadata"]["title"] == "Test Catalog"

        # Serialize back to XML
        serialized = serialize_oscal_dict_to_xml(parsed)
        assert "Test Catalog" in serialized
        assert "00000000-0000-0000-0000-000000000000" in serialized

    def test_xml_invalid_raises_error(self):
        with pytest.raises(Exception):
            parse_xml_to_oscal_dict("<invalid-xml")

    def test_xml_empty_dict_raises_value_error(self):
        with pytest.raises(ValueError, match="Empty dictionary"):
            serialize_oscal_dict_to_xml({})

    def test_yaml_to_dict_and_back(self):
        yaml_input = """catalog:
  uuid: 00000000-0000-0000-0000-000000000000
  metadata:
    title: Test Catalog
"""
        parsed = parse_yaml_to_dict(yaml_input)
        assert parsed["catalog"]["uuid"] == "00000000-0000-0000-0000-000000000000"

        serialized = serialize_dict_to_yaml(parsed)
        assert "Test Catalog" in serialized

    def test_yaml_invalid_input_raises_error(self):
        with pytest.raises(Exception):
            parse_yaml_to_dict("catalog: [unclosed list")

    def test_set_parameter_singular_plural_mappings(self):
        from app.format_converter import SINGULAR_TO_PLURAL, PLURAL_TO_SINGULAR
        assert SINGULAR_TO_PLURAL["set-parameter"] == "set-parameters"
        assert PLURAL_TO_SINGULAR["set-parameters"] == "set-parameter"

    def test_xml_set_parameter_under_set_parameters(self):
        xml_input = """<?xml version="1.0" encoding="utf-8"?>
<set-parameters xmlns="http://csrc.nist.gov/ns/oscal/1.0">
  <set-parameter param-id="param-1">
    <values>
      <value>val-1</value>
    </values>
  </set-parameter>
  <set-parameter param-id="param-2">
    <values>
      <value>val-2</value>
    </values>
  </set-parameter>
</set-parameters>
"""
        parsed = parse_xml_to_oscal_dict(xml_input)
        assert "set-parameters" in parsed
        set_params = parsed["set-parameters"]
        assert isinstance(set_params, list)
        assert len(set_params) == 2
        assert set_params[0]["param-id"] == "param-1"
        assert set_params[1]["param-id"] == "param-2"

    def test_xml_set_parameter_direct_under_parent(self):
        xml_input = """<?xml version="1.0" encoding="utf-8"?>
<modify xmlns="http://csrc.nist.gov/ns/oscal/1.0">
  <set-parameter param-id="param-1">
    <values>
      <value>val-1</value>
    </values>
  </set-parameter>
  <set-parameter param-id="param-2">
    <values>
      <value>val-2</value>
    </values>
  </set-parameter>
</modify>
"""
        parsed = parse_xml_to_oscal_dict(xml_input)
        assert "modify" in parsed
        assert "set-parameters" in parsed["modify"]
        set_params = parsed["modify"]["set-parameters"]
        assert isinstance(set_params, list)
        assert len(set_params) == 2
        assert set_params[0]["param-id"] == "param-1"
        assert set_params[1]["param-id"] == "param-2"

        # Test roundtrip serialization to XML
        serialized = serialize_oscal_dict_to_xml(parsed)
        assert "set-parameter" in serialized
        assert "param-1" in serialized
        assert "param-2" in serialized

