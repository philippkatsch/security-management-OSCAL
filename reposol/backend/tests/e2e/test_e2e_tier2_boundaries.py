"""
Tier 2: Boundary & Corner Case End-to-End Tests (T2-F1-01 to T2-F5-05).
Covers boundary values, missing param references, invalid choice selection, regex constraint failures,
unresolvable parameters, special characters, max string lengths, empty array purging, and circular references.
"""

import time
import pytest
from tests.factories import CatalogFactory, ProfileFactory
from tests.e2e.e2e_helpers import resolve_parameters, render_control_prose
from app.validation import validate_document
from jsonschema import ValidationError


class TestTier2BoundaryCornerCases:
    """Tier 2: Boundary & Corner Cases (25 Test Cases)."""

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F1 Boundary & Corner Cases
    # ─────────────────────────────────────────────────────────────────────────

    def test_t2_f1_01_empty_string_value(self, client):
        """T2-F1-01: Assign empty string as free-text parameter value."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "label": "Review Frequency", "values": [""]}],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        # Empty string purged by remove_empty_arrays
        assert "values" not in param

    def test_t2_f1_02_whitespace_only_string_value(self, client):
        """T2-F1-02: Assign whitespace-only string as parameter value."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "label": "Review Frequency", "values": ["   "]}],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        # Whitespace-only string trimmed and purged
        assert "values" not in param

    def test_t2_f1_03_max_length_string_value(self, client):
        """T2-F1-03: Assign maximum length string (4096+ chars) as parameter value."""
        long_str = "A" * 4096
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": [long_str]}],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["values"] == [long_str]
        assert len(param["values"][0]) == 4096

    def test_t2_f1_04_special_chars_xml_json(self, client):
        """T2-F1-04: Assign special characters and XML/JSON control chars in value."""
        special_val = "<script>alert(1)</script> & ' \""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "label": "Special Chars", "values": [special_val]}],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["values"] == [special_val]

    def test_t2_f1_05_utf8_multibyte_emojis(self, client):
        """T2-F1-05: Assign UTF-8 multi-byte characters and emojis in parameter value."""
        utf8_val = "Benutzerkennwort 🔑 & 🛡️ Standard"
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": [utf8_val]}],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["values"] == [utf8_val]

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F2 Boundary & Corner Cases
    # ─────────────────────────────────────────────────────────────────────────

    def test_t2_f2_01_empty_choice_array(self, client):
        """T2-F2-01: Select choice option when select.choice[] array is empty."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "select": {"how-many": "one", "choice": []},
                            "values": ["12"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["12"]
        # Empty choice array purged
        assert "choice" not in param.get("select", {})

    def test_t2_f2_02_select_value_not_in_choice(self, client):
        """T2-F2-02: Select choice value not present in select.choice[] array."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "select": {"how-many": "one", "choice": ["A", "B"]},
                            "values": ["C"],  # Custom value "C"
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["C"]

    def test_t2_f2_03_duplicate_choices(self, client):
        """T2-F2-03: Duplicate entries in select.choice[] list."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "cm-2",
                    "title": "Baseline Configuration",
                    "params": [
                        {
                            "id": "cm-2_prm_1",
                            "select": {
                                "how-many": "one",
                                "choice": ["Option1", "Option1", "Option2"],
                            },
                            "values": ["Option1"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        choices = saved_doc["catalog"]["controls"][0]["params"][0]["select"]["choice"]
        # Deduplication or valid storage checked
        assert "Option1" in choices and "Option2" in choices

    def test_t2_f2_04_how_many_one_multiple_values(self, client):
        """T2-F2-04: how-many: one with multiple values assigned via API."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "select": {"how-many": "one", "choice": ["Val1", "Val2"]},
                            "values": ["Val1", "Val2"],  # Multiple values for single-select
                        }
                    ],
                }
            ]
        )
        # OSCAL schema allows values list for param, system accepts or handles cleanly
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

    def test_t2_f2_05_how_many_one_or_more_empty_selection(self, client):
        """T2-F2-05: how-many: one-or-more with empty selection array."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "sc-8",
                    "title": "Transmission Confidentiality",
                    "params": [
                        {
                            "id": "sc-8_prm_1",
                            "label": "Encryption Protocols",
                            "select": {
                                "how-many": "one-or-more",
                                "choice": ["TLS 1.2", "TLS 1.3"],
                            },
                            "values": [],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        saved_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        resolved = resolve_parameters(saved_doc)
        prose = "Use protocols: {{ insert: param, sc-8_prm_1 }}."
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Use protocols: [Encryption Protocols]."

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F3 Boundary & Corner Cases
    # ─────────────────────────────────────────────────────────────────────────

    def test_t2_f3_01_unresolvable_override_param_id(self, client):
        """T2-F3-01: Override parameter ID that does not exist in source Catalog."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": ["8"]}],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "non_existent_param", "values": ["X"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        res = client.post("/api/documents/profile", json=prof_doc)
        assert res.status_code == 201

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)
        # Catalog param ac-1_prm_1 is preserved, unresolvable param doesn't crash resolver
        assert resolved["ac-1_prm_1"]["values"] == ["8"]

    def test_t2_f3_02_duplicate_override_param_ids(self, client):
        """T2-F3-02: Duplicate parameter ID overrides in set-parameters[]."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "p1", "values": ["default"]}],
                }
            ]
        )
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_doc["catalog"]["uuid"],
            set_parameters=[
                {"param-id": "p1", "values": ["A"]},
                {"param-id": "p1", "values": ["B"]},
            ],
        )
        resolved = resolve_parameters(cat_doc, prof_doc)
        # Last override ("B") wins deterministically
        assert resolved["p1"]["values"] == ["B"]

    def test_t2_f3_03_invalid_null_uuid_override(self, client):
        """T2-F3-03: Profile override with null or empty param-id."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ac-1", "title": "AC", "params": [{"id": "p1", "values": ["8"]}]}]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "", "values": ["14"]}],  # Empty string param-id
        )
        # Preprocess / validate catches invalid empty param-id
        from app.storage import preprocess_profile_for_saving
        val_doc = preprocess_profile_for_saving(prof_doc, persist_local_catalog=False)
        with pytest.raises(ValidationError):
            validate_document("profiles", val_doc)

    def test_t2_f3_04_override_empty_values_array_revert(self, client):
        """T2-F3-04: Profile override setting empty values array (reverting value only)."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ac-1", "title": "AC", "params": [{"id": "p1", "values": ["8"]}]}]
        )
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_doc["catalog"]["uuid"],
            set_parameters=[{"param-id": "p1", "values": []}],
        )
        resolved = resolve_parameters(cat_doc, prof_doc)
        # Falls back to catalog value "8"
        assert resolved["p1"]["values"] == ["8"]

    def test_t2_f3_05_circular_parameter_self_ref(self):
        """T2-F3-05: Circular parameter dependence or invalid parameter self-reference."""
        resolved = {"p1": {"id": "p1", "values": ["{{ insert: param, p1 }}"]}}
        prose = "Value is {{ insert: param, p1 }}."
        # Safe resolution without infinite recursion crash
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Value is [p1]."

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F4 Boundary & Corner Cases
    # ─────────────────────────────────────────────────────────────────────────

    def test_t2_f4_01_missing_param_id_reference(self):
        """T2-F4-01: Render prose with missing parameter ID reference."""
        prose = "Value is {{ insert: param, missing_id }}."
        resolved = {}
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Value is [missing_id]."

    def test_t2_f4_02_malformed_insert_syntax(self):
        """T2-F4-02: Render prose with malformed insert syntax."""
        prose = "Requirement: {{ insert: param }} or {{ insert: }}."
        resolved = {}
        rendered = render_control_prose(prose, resolved)
        assert "[ERROR: malformed insert]" in rendered

    def test_t2_f4_03_performance_50_plus_inserts(self):
        """T2-F4-03: Render prose with 50+ inline parameter inserts (<50ms execution time)."""
        resolved = {f"p_{i}": {"id": f"p_{i}", "values": [f"val_{i}"]} for i in range(50)}
        prose_parts = [f"Item {i}: {{{{ insert: param, p_{i} }}}}" for i in range(50)]
        prose = ". ".join(prose_parts)

        start = time.perf_counter()
        rendered = render_control_prose(prose, resolved)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 50.0, f"Execution took {elapsed_ms:.2f}ms"
        assert "Item 0: val_0" in rendered
        assert "Item 49: val_49" in rendered

    def test_t2_f4_04_html_markdown_tags_in_value(self):
        """T2-F4-04: Render parameter value containing HTML/Markdown tags."""
        resolved = {"p1": {"id": "p1", "values": ["<b>14 days</b>"]}}
        prose = "Period: {{ insert: param, p1 }}."
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Period: <b>14 days</b>."

    def test_t2_f4_05_trailing_leading_newlines(self):
        """T2-F4-05: Render parameter value with trailing and leading newlines."""
        resolved = {"p1": {"id": "p1", "values": ["\n\n14\n\n"]}}
        prose = "Value: {{ insert: param, p1 }}."
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Value: 14."

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F5 Boundary & Corner Cases
    # ─────────────────────────────────────────────────────────────────────────

    def test_t2_f5_01_constraint_regex_mismatch(self, client):
        """T2-F5-01: Export document with parameter constraint regex mismatch."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {
                            "id": "ac-2_prm_1",
                            "values": ["abc"],  # Violates ^[0-9]+$ regex
                            "constraints": [
                                {
                                    "tests": [
                                        {"expression": "^[0-9]+$", "remarks": "Must be numeric"}
                                    ]
                                }
                            ],
                        }
                    ],
                }
            ]
        )
        # Catalog data structure passes schema validation, constraint stored for execution check
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

    def test_t2_f5_02_purge_empty_set_parameters_array(self, client):
        """T2-F5-02: Export profile document with empty set-parameters array."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ac-1", "title": "AC", "params": [{"id": "p1", "values": ["8"]}]}]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        res_export = client.get(f"/api/export/profile/{prof_id}?format=json")
        exported = res_export.json()
        assert "set-parameters" not in exported.get("profile", {}).get("modify", {})

    def test_t2_f5_03_invalid_root_structure(self, client):
        """T2-F5-03: Import OSCAL JSON with invalid root structure or missing schema version."""
        malformed_doc = {"invalid_root_key": {"uuid": "12345678-1234-1234-1234-123456789abc"}}
        res = client.post("/api/documents/catalog", json=malformed_doc)
        assert res.status_code == 400

    def test_t2_f5_04_unknown_schema_fields(self, client):
        """T2-F5-04: Import OSCAL JSON containing extra unknown schema fields."""
        doc = CatalogFactory.build()
        doc["catalog"]["unknown_custom_field"] = True
        res = client.post("/api/documents/catalog", json=doc)
        # Validator rejects unknown additional properties at root
        assert res.status_code == 400

    def test_t2_f5_05_roundtrip_serialization_fidelity(self, client):
        """T2-F5-05: Roundtrip export/import serialization fidelity."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {
                            "id": "ac-1_prm_1",
                            "label": "Review Frequency",
                            "values": ["30 days"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        # 1. Export JSON
        exported_json = client.get(f"/api/export/catalog/{cat_id}?format=json").json()

        # 2. Delete document from storage
        client.delete(f"/api/documents/catalog/{cat_id}?force=true")

        # 3. Re-import exported JSON
        res_reimport = client.post("/api/documents/catalog", json=exported_json)
        assert res_reimport.status_code in [200, 201]

        # 4. Verify exact match
        reimported_doc = client.get(f"/api/documents/catalog/{cat_id}").json()
        param = reimported_doc["catalog"]["controls"][0]["params"][0]
        assert param["id"] == "ac-1_prm_1"
        assert param["label"] == "Review Frequency"
        assert param["values"] == ["30 days"]
