"""
Unit tests for app/format_converter.py covering:
- R6-01: Singular to plural array mappings and plural to singular XML tags
- R6-02: Mixed-content XML parsing preserving text/tail and param inserts
- R1-08: XML attributes serialization flags
- YAML conversion roundtrip
- Error handling for malformed inputs
"""
import xml.etree.ElementTree as ET
import pytest
from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    serialize_dict_to_yaml,
    SINGULAR_TO_PLURAL,
    PLURAL_TO_SINGULAR,
    XML_ATTRIBUTES
)


class TestFormatConverter:
    # -------------------------------------------------------------------------
    # R6-01: Singular / Plural Mappings Tests
    # -------------------------------------------------------------------------
    def test_required_singular_to_plural_keys_exist(self):
        required_keys = [
            "import", "alter", "add", "remove", "resource", "revision",
            "responsible-party", "responsible-role", "with-id", "rlink",
            "document-id", "address", "addr-line", "email-address",
            "telephone-number", "external-id", "hash", "url", "protocol",
            "port-range", "import-component-definition", "defined-component",
            "system-component", "capability", "control-implementation",
            "implemented-requirement", "statement", "statement-id", "task",
            "result", "set-parameter"
        ]
        for key in required_keys:
            assert key in SINGULAR_TO_PLURAL, f"Missing '{key}' in SINGULAR_TO_PLURAL"

    def test_required_plural_to_singular_keys_exist(self):
        required_keys = [
            "imports", "alters", "adds", "removes", "resources", "revisions",
            "responsible-parties", "responsible-roles", "with-ids", "rlinks",
            "document-ids", "addresses", "addr-lines", "email-addresses",
            "telephone-numbers", "external-ids", "hashes", "urls", "protocols",
            "port-ranges", "import-component-definitions", "components",
            "capabilities", "control-implementations", "implemented-requirements",
            "statements", "statement-ids", "tasks", "results", "set-parameters"
        ]
        for key in required_keys:
            assert key in PLURAL_TO_SINGULAR, f"Missing '{key}' in PLURAL_TO_SINGULAR"

    def test_xml_profile_multi_import_alter_preservation(self):
        xml_profile = """<?xml version="1.0" encoding="UTF-8"?>
<profile xmlns="http://csrc.nist.gov/ns/oscal/1.0" uuid="036213db-02d3-4234-8963-b83f79634e36">
  <metadata>
    <title>Multi-Import Test Profile</title>
    <last-modified>2026-08-31T12:00:00Z</last-modified>
    <version>1.0.0</version>
    <oscal-version>1.0.0</oscal-version>
    <revision>
      <title>Rev 1</title>
      <version>0.9</version>
    </revision>
    <revision>
      <title>Rev 2</title>
      <version>1.0</version>
    </revision>
    <responsible-party role-id="author">
      <party-uuid>11111111-1111-1111-1111-111111111111</party-uuid>
    </responsible-party>
  </metadata>
  <import href="catalogs/cat1.xml">
    <include-controls>
      <with-id>ac-1</with-id>
      <with-id>ac-2</with-id>
    </include-controls>
  </import>
  <import href="catalogs/cat2.xml">
    <include-controls>
      <with-id>ia-1</with-id>
    </include-controls>
  </import>
  <modify>
    <alter control-id="ac-1">
      <add position="ending" by-id="ac-1_smt">
        <prop name="custom-prop" value="custom-val"/>
      </add>
      <add position="starting" by-id="ac-1_smt">
        <part name="statement" id="ac-1_sub">
          <p>Sub statement text</p>
        </part>
      </add>
      <remove by-name="deprecated-prop"/>
      <remove by-id="old-part"/>
    </alter>
    <alter control-id="ia-1">
      <remove by-class="optional"/>
    </alter>
  </modify>
  <back-matter>
    <resource uuid="4d263315-ebac-45cc-801e-f5a986cd59a9">
      <title>Ref 1</title>
      <rlink href="https://example.com/cat1.xml"/>
      <rlink href="https://mirror.example.com/cat1.xml"/>
    </resource>
  </back-matter>
</profile>
"""
        parsed = parse_xml_to_oscal_dict(xml_profile)
        prof = parsed["profile"]

        # Imports preserved as array
        assert isinstance(prof.get("imports"), list)
        assert len(prof["imports"]) == 2
        assert prof["imports"][0]["include-controls"]["with-ids"] == ["ac-1", "ac-2"]

        # Alters, adds, removes preserved as arrays
        alters = prof["modify"]["alters"]
        assert isinstance(alters, list)
        assert len(alters) == 2
        assert alters[0]["control-id"] == "ac-1"
        assert len(alters[0]["adds"]) == 2
        assert len(alters[0]["removes"]) == 2

        # Revisions and resources
        assert len(prof["metadata"]["revisions"]) == 2
        assert len(prof["back-matter"]["resources"][0]["rlinks"]) == 2

    # -------------------------------------------------------------------------
    # R6-02: Mixed-Content Prose & Param Inserts Tests
    # -------------------------------------------------------------------------
    def test_xml_mixed_content_with_param_inserts(self):
        xml_catalog = """<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://csrc.nist.gov/ns/oscal/1.0" uuid="6c5149e8-f3a6-437c-8035-025e9b5fc0bf">
  <metadata>
    <title>Mixed Prose Catalog</title>
    <last-modified>2026-08-31T12:00:00Z</last-modified>
    <version>1.0</version>
    <oscal-version>1.0.0</oscal-version>
  </metadata>
  <group>
    <title>Access Control</title>
    <control id="ac-1">
      <title>Policy and Procedures</title>
      <param id="ac-1_prm_1">
        <label>frequency</label>
      </param>
      <part name="statement" id="ac-1_smt">
        <p>The organization reviews and updates policies at least <insert param-id="ac-1_prm_1"/> or following <strong>significant</strong> events.</p>
        <p>Procedures are documented and available at <a href="https://internal.example.gov">the intranet</a>.</p>
      </part>
    </control>
  </group>
</catalog>
"""
        parsed = parse_xml_to_oscal_dict(xml_catalog)
        part = parsed["catalog"]["groups"][0]["controls"][0]["parts"][0]
        assert "prose" in part
        assert "The organization reviews and updates policies at least {{ insert: param, ac-1_prm_1 }} or following **significant** events." in part["prose"]
        assert "Procedures are documented and available at [the intranet](https://internal.example.gov)." in part["prose"]

    def test_xml_id_ref_insert_format(self):
        xml_input = """<part xmlns="http://csrc.nist.gov/ns/oscal/1.0" name="statement" id="a1-stmt">
  <p>A1 aaaaa <insert type="param" id-ref="a1_prm1"/> aaaaaaaaaa</p>
</part>"""
        el = ET.fromstring(xml_input)
        from app.format_converter import xml_to_dict
        res = xml_to_dict(el)
        assert res["prose"] == "A1 aaaaa {{ insert: param, a1_prm1 }} aaaaaaaaaa"

    # -------------------------------------------------------------------------
    # R1-08: XML Attributes Export Serialization Tests
    # -------------------------------------------------------------------------
    def test_xml_attribute_serialization(self):
        data = {
            "profile": {
                "uuid": "036213db-02d3-4234-8963-b83f79634e36",
                "metadata": {"title": "Attr Test"},
                "imports": [{"href": "cat.xml"}],
                "modify": {
                    "alters": [
                        {
                            "control-id": "ac-1",
                            "adds": [
                                {
                                    "position": "ending",
                                    "by-id": "ac-1_smt",
                                    "props": [{"name": "test", "value": "val"}]
                                }
                            ],
                            "removes": [
                                {
                                    "by-name": "old-prop",
                                    "by-class": "legacy",
                                    "by-id": "old-part"
                                }
                            ]
                        }
                    ]
                }
            }
        }
        xml_out = serialize_oscal_dict_to_xml(data)

        # Validate that flags render as XML attributes, NOT child elements
        assert 'control-id="ac-1"' in xml_out
        assert '<control-id>' not in xml_out

        assert 'position="ending"' in xml_out
        assert '<position>' not in xml_out

        assert 'by-id="ac-1_smt"' in xml_out
        assert '<by-id>' not in xml_out

        assert 'by-name="old-prop"' in xml_out
        assert '<by-name>' not in xml_out

        assert '<imports' not in xml_out
        assert '<alters' not in xml_out
        assert '<adds' not in xml_out
        assert '<removes' not in xml_out

    # -------------------------------------------------------------------------
    # Round-Trip & Error Handling Tests
    # -------------------------------------------------------------------------
    def test_prose_with_inserts_roundtrip(self):
        data = {
            "catalog": {
                "uuid": "6c5149e8-f3a6-437c-8035-025e9b5fc0bf",
                "metadata": {"title": "Roundtrip Catalog"},
                "controls": [
                    {
                        "id": "ac-1",
                        "title": "Control 1",
                        "parts": [
                            {
                                "id": "ac-1_smt",
                                "name": "statement",
                                "prose": "Review {{ insert: param, p1 }} every 30 days.\n\nEscalate {{ insert: param, p2 }} immediately."
                            }
                        ]
                    }
                ]
            }
        }
        xml_out = serialize_oscal_dict_to_xml(data)
        assert '<insert param-id="p1"' in xml_out
        assert '<insert param-id="p2"' in xml_out

        reparsed = parse_xml_to_oscal_dict(xml_out)
        reparsed_prose = reparsed["catalog"]["controls"][0]["parts"][0]["prose"]
        assert "{{ insert: param, p1 }}" in reparsed_prose
        assert "{{ insert: param, p2 }}" in reparsed_prose

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


