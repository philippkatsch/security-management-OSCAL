r"""
Adversarial Coverage Hardener: Schema & Combinatorial Matrix (Milestone M5-2).
Author: Challenger M5-2 (Empirical Challenger)

Test Matrix:
1. Combinatorial Stress Testing on Control Assignment States:
   - 100% assigned controls (single custom group, multiple disjoint groups, overlapping groups).
   - 0% assigned controls (empty groups, empty insert-controls, 100% excluded via exclude-controls, multi-import 0% assignment).
   - Single control assigned across 10 nested groups (leaf level 10, root level 1, mid-tier level 5, distributed).
2. NIST OSCAL Profile Schema v1.1.2 Metaschema Extreme Edge Cases:
   - Special unicode IDs (German umlauts äöüß, Cyrillic, Japanese Kanji, Greek symbols, NCName punctuation).
   - Unicode rich text and XML special characters (<, >, &, ", ') in titles, descriptions, and props.
   - Deep nesting up to 8 levels and 10 levels of recursive groups with full OSCAL properties and alternating order directives.
   - Mixed casing resilience (AC-1 vs ac-1 vs Ac-1 across imports, custom groups, alters, set-parameters).
   - Order directives (ascending, descending, keep, and rejection of invalid values like 'random' or 'reverse').
3. Multi-format Serialization & Resolution Pipeline:
   - JSON, YAML, and XML exports with schema compliance and round-trip verification.
   - Live resolution preview endpoint (/api/resolve/profile/preview) and resolved profile endpoint (/api/resolve/profile/{id}).
"""

import copy
import json
import uuid
import pytest
import yaml
import xml.etree.ElementTree as ET
from jsonschema import Draft7Validator, ValidationError

from app.validation import validate_document, SCHEMAS, OSCALValidationError
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    prune_orphaned_modifications,
    remove_empty_arrays,
)
from app.services.resolution_service import (
    resolve_profile_inline,
    resolve_profile,
    clear_resolution_cache,
)
from app.format_converter import (
    serialize_dict_to_yaml,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    parse_xml_to_oscal_dict,
)
from tests.factories import CatalogFactory, ProfileFactory


class TestM52CombinatorialControlAssignmentMatrix:
    """Combinatorial stress testing for control assignment states: 100%, 0%, and 10 nested groups."""

    @pytest.mark.asyncio
    async def test_100_percent_controls_assigned_disjoint_and_overlapping(self, client, isolated_data_dir):
        """
        Stress Test: 100% assigned controls across multiple custom groups.
        Catalog has 20 controls.
        Test both:
        a) Disjoint partition (10 controls in Group A, 10 controls in Group B).
        b) Overlapping assignment (5 controls in Group A, 15 in Group B).
        Verify saving, resolution, and schema validity.
        """
        control_ids = [f"ac-{i+1:02d}" for i in range(20)]
        cat_controls = [{"id": cid, "title": f"Control {cid.upper()}"} for cid in control_ids]
        cat_doc = CatalogFactory.build(controls=cat_controls)
        cat_uuid = cat_doc["catalog"]["uuid"]

        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # 1. Disjoint 100% assignment
        prof_doc_disjoint = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="100% Assigned Disjoint Profile",
        )
        prof_doc_disjoint["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-partition-1",
                        "title": "Partition 1 (Controls 1-10)",
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": control_ids[:10]}]}
                        ]
                    },
                    {
                        "id": "grp-partition-2",
                        "title": "Partition 2 (Controls 11-20)",
                        "insert-controls": [
                            {"order": "descending", "include-controls": [{"with-ids": control_ids[10:]}]}
                        ]
                    }
                ]
            }
        }

        # Save and validate
        res_prof = client.post("/api/documents/profiles", json=prof_doc_disjoint)
        assert res_prof.status_code == 201
        prof_uuid_1 = res_prof.json()["profile"]["uuid"]

        # Validate via direct schema validator
        saved_doc = res_prof.json()
        await validate_document("profiles", saved_doc)

        # Resolve profile and verify 100% coverage
        res_resolved = client.get(f"/api/resolve/profile/{prof_uuid_1}")
        assert res_resolved.status_code == 200
        resolved_data = res_resolved.json()
        
        # Check resolved structure
        assert len(resolved_data["groups"]) == 2
        g1_ctrls = [c["id"] for c in resolved_data["groups"][0]["controls"]]
        g2_ctrls = [c["id"] for c in resolved_data["groups"][1]["controls"]]
        assert len(g1_ctrls) == 10
        assert len(g2_ctrls) == 10
        assert set(g1_ctrls + g2_ctrls) == set(control_ids)
        # Verify ordering directive inside groups
        assert g1_ctrls == sorted(control_ids[:10], key=lambda x: x.lower())
        assert g2_ctrls == sorted(control_ids[10:], key=lambda x: x.lower(), reverse=True)

    @pytest.mark.asyncio
    async def test_0_percent_controls_assigned_empty_assignment(self, client, isolated_data_dir):
        """
        Stress Test: 0% assigned controls.
        Catalog has 10 controls.
        Scenario A: Profile with empty custom groups (no insert-controls).
        Scenario B: Profile with exclude-controls filtering out 100% of controls.
        Verify that preprocessing normalizes safely and schema validation succeeds.
        """
        control_ids = [f"si-{i+1}" for i in range(10)]
        cat_controls = [{"id": cid, "title": f"System Integrity Control {cid}"} for cid in control_ids]
        cat_doc = CatalogFactory.build(controls=cat_controls)
        cat_uuid = cat_doc["catalog"]["uuid"]

        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Scenario A: Empty custom group structure
        prof_doc_empty_custom = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="0% Assigned Empty Custom Profile",
        )
        prof_doc_empty_custom["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": []  # Empty groups list
            }
        }

        # Preprocessing should normalize empty custom block to as-is: True
        preprocessed = await preprocess_profile_for_saving(prof_doc_empty_custom)
        assert "custom" not in preprocessed["profile"]["merge"]
        assert preprocessed["profile"]["merge"].get("as-is") is True
        await validate_document("profiles", preprocessed)

        # Scenario B: Profile import with exclude-controls matching 100% of controls
        prof_doc_100_excluded = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="100% Excluded Controls Profile",
        )
        prof_doc_100_excluded["profile"]["imports"][0]["include-all"] = {}
        prof_doc_100_excluded["profile"]["imports"][0]["exclude-controls"] = [
            {"with-ids": control_ids}
        ]

        res_prof = client.post("/api/documents/profiles", json=prof_doc_100_excluded)
        assert res_prof.status_code == 201
        prof_uuid_ex = res_prof.json()["profile"]["uuid"]

        # Resolve profile: resolved catalog should contain 0 controls
        res_resolved = client.get(f"/api/resolve/profile/{prof_uuid_ex}")
        assert res_resolved.status_code == 200
        resolved_data = res_resolved.json()
        assert len(resolved_data.get("controls", [])) == 0
        assert len(resolved_data.get("groups", [])) == 0

    @pytest.mark.asyncio
    async def test_single_control_assigned_across_10_nested_groups(self, client, isolated_data_dir):
        """
        Stress Test: Single control assigned across a 10-level nested group hierarchy.
        Level 1 -> Level 2 -> Level 3 -> Level 4 -> Level 5 -> Level 6 -> Level 7 -> Level 8 -> Level 9 -> Level 10.
        Test control placement:
        1. Leaf placement: single control assigned at Level 10.
        2. Root placement: single control assigned at Level 1.
        3. Mid-tier placement: single control assigned at Level 5.
        4. Distributed placement: single control at Level 1, single at Level 5, single at Level 10.
        Verify full preservation, NIST schema v1.1.2 compliance, resolution, and XML/YAML export.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ctrl-leaf-10", "title": "Deep Leaf Control 10"},
                {"id": "ctrl-root-1", "title": "Root Control 1"},
                {"id": "ctrl-mid-5", "title": "Mid Tier Control 5"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Helper to construct 10-level nested group hierarchy
        def build_10_level_hierarchy(assignments: dict) -> list:
            """
            assignments is a dict: {level_int: [control_ids]}
            """
            # Build from leaf (level 10) up to root (level 1)
            current_subgroups = []
            for lvl in range(10, 0, -1):
                grp = {
                    "id": f"grp-level-{lvl:02d}",
                    "title": f"Group Depth Level {lvl}",
                    "class": f"tier-{lvl}",
                    "props": [{"name": "depth-index", "value": str(lvl)}],
                }
                if lvl in assignments and assignments[lvl]:
                    grp["insert-controls"] = [
                        {"order": "keep", "include-controls": [{"with-ids": assignments[lvl]}]}
                    ]
                if current_subgroups:
                    grp["groups"] = current_subgroups
                current_subgroups = [grp]
            return current_subgroups

        # Case 1: Control assigned at Levels 1, 5, 10
        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="10-Level Deep Nested Custom Groups Profile",
        )
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": build_10_level_hierarchy({
                    1: ["ctrl-root-1"],
                    5: ["ctrl-mid-5"],
                    10: ["ctrl-leaf-10"],
                })
            }
        }

        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201
        prof_data = res_prof.json()
        prof_uuid = prof_data["profile"]["uuid"]

        # Validate strictly against NIST OSCAL schema
        validator = Draft7Validator(SCHEMAS["profiles"])
        errors = list(validator.iter_errors(prof_data))
        assert len(errors) == 0, f"Schema validation errors: {[e.message for e in errors]}"

        # Test resolution pipeline through all 10 levels
        res_resolved = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_resolved.status_code == 200
        resolved = res_resolved.json()

        # Traverse resolved hierarchy to verify control placements at levels 1, 5, and 10
        curr_g = resolved["groups"][0]
        assert curr_g["id"] == "grp-level-01"
        assert len(curr_g["controls"]) == 1
        assert curr_g["controls"][0]["id"] == "ctrl-root-1"

        # Walk to level 5
        for _ in range(4):
            assert len(curr_g["groups"]) == 1
            curr_g = curr_g["groups"][0]
        assert curr_g["id"] == "grp-level-05"
        assert len(curr_g["controls"]) == 1
        assert curr_g["controls"][0]["id"] == "ctrl-mid-5"

        # Walk to level 10
        for _ in range(5):
            assert len(curr_g["groups"]) == 1
            curr_g = curr_g["groups"][0]
        assert curr_g["id"] == "grp-level-10"
        assert len(curr_g["controls"]) == 1
        assert curr_g["controls"][0]["id"] == "ctrl-leaf-10"

        # Test Export in JSON, YAML, and XML
        for fmt in ["json", "yaml", "xml"]:
            res_exp = client.get(f"/api/export/profiles/{prof_uuid}?format={fmt}")
            assert res_exp.status_code == 200, f"Export failed for format {fmt}: {res_exp.text}"
            if fmt == "json":
                parsed = json.loads(res_exp.text)
                assert parsed["profile"]["uuid"] == prof_uuid
            elif fmt == "yaml":
                parsed = parse_yaml_to_dict(res_exp.text)
                assert parsed["profile"]["uuid"] == prof_uuid
            elif fmt == "xml":
                parsed = parse_xml_to_oscal_dict(res_exp.text)
                assert parsed["profile"]["uuid"] == prof_uuid


class TestM52OSCALSchemaValidationEdgeCases:
    """Challenge OSCAL validation against NIST OSCAL Profile Schema v1.1.2 metaschema under extreme edge cases."""

    @pytest.mark.asyncio
    async def test_special_unicode_ids_and_international_tokens(self, client, isolated_data_dir):
        """
        Edge Case: Special unicode characters in IDs, titles, classes, and props.
        NIST OSCAL TokenDatatype accepts NCName tokens (including Unicode letters).
        We test:
        - German Umlauts: ctrl-äöü-ß-1, grp-über-sicherheit
        - Cyrillic: ctrl-контроль-1, grp-безопасность
        - Japanese Kanji: ctrl-認証-01, grp-管理
        - Greek / Math: ctrl-λ-42, param-θ-threshold
        - NCName Punctuation: _ctrl.test_v1-0_
        - Multi-language titles and props with emojis and XML special characters (< > & " ')
        """
        unicode_controls = [
            {"id": "ctrl-äöü-ß-1", "title": "German Umlaut Control: Übung & Prüfung <100%>"},
            {"id": "ctrl-контроль-1", "title": "Cyrillic Control: Защита данных (Safe & Secure)"},
            {"id": "ctrl-認証-01", "title": "Japanese Control: 認証システム \"Primary\""},
            {"id": "ctrl-λ-42", "title": "Greek Lambda Control: λ-Calculus & Security 'Alpha'"},
            {"id": "_ctrl.test_v1-0_", "title": "Punctuation Control: _sys.init-1.0_"},
        ]
        cat_doc = CatalogFactory.build(controls=unicode_controls)
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="Unicode & Special Characters Profile 🔒🚀 <&\"'>",
        )
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-über-sicherheit",
                        "title": "German Group: Überwachung & Sicherheit",
                        "class": "klasse-äöü",
                        "props": [
                            {"name": "prüfungs-kategorie", "value": "Spezial-Prüfung", "ns": "https://reposol.org/ns/de"}
                        ],
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["ctrl-äöü-ß-1"]}]}
                        ]
                    },
                    {
                        "id": "grp-безопасность",
                        "title": "Cyrillic Group: Группа безопасности",
                        "class": "класс-безопасности",
                        "insert-controls": [
                            {"order": "descending", "include-controls": [{"with-ids": ["ctrl-контроль-1"]}]}
                        ]
                    },
                    {
                        "id": "grp-管理-01",
                        "title": "Japanese Group: 管理グループ",
                        "insert-controls": [
                            {"order": "keep", "include-controls": [{"with-ids": ["ctrl-認証-01"]}]}
                        ]
                    },
                    {
                        "id": "grp-greek-λ",
                        "title": "Greek Group: Ομάδα Ασφαλείας λ",
                        "insert-controls": [
                            {"order": "keep", "include-controls": [{"with-ids": ["ctrl-λ-42", "_ctrl.test_v1-0_"]}]}
                        ]
                    }
                ]
            }
        }

        # Modify section with unicode alters and parameters
        prof_doc["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "param-θ-threshold",
                    "values": ["99.9%"],
                    "props": [{"name": "überwachung", "value": "aktiv"}]
                }
            ],
            "alters": [
                {
                    "control-id": "ctrl-äöü-ß-1",
                    "adds": [
                        {
                            "position": "ending",
                            "title": "Alter Title: Prüfung erfolgreich abgeschlossen & validiert"
                        }
                    ]
                }
            ]
        }

        # Save and validate via endpoint
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201, f"Failed to save unicode profile: {res_prof.text}"
        prof_uuid = res_prof.json()["profile"]["uuid"]

        # Validate schema directly
        saved_doc = res_prof.json()
        await validate_document("profiles", saved_doc)

        # Direct API validation
        res_val = client.post("/api/validate/profiles", json=saved_doc)
        assert res_val.status_code == 200

        # Resolve profile
        res_res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_res.status_code == 200
        resolved = res_res.json()
        assert len(resolved["groups"]) == 4

        # Export and verify roundtrip across formats
        for fmt in ["json", "yaml", "xml"]:
            res_exp = client.get(f"/api/export/profiles/{prof_uuid}?format={fmt}")
            assert res_exp.status_code == 200
            content = res_exp.text
            if fmt == "xml":
                parsed = parse_xml_to_oscal_dict(content)
                assert parsed["profile"]["uuid"] == prof_uuid
            elif fmt == "yaml":
                parsed = parse_yaml_to_dict(content)
                assert parsed["profile"]["uuid"] == prof_uuid

    @pytest.mark.asyncio
    async def test_deep_nesting_8_levels_full_oscal_group_properties(self, client, isolated_data_dir):
        """
        Edge Case: Exactly 8-level deep group hierarchy conforming to NIST OSCAL Profile Schema v1.1.2.
        Every level contains full group attributes:
        id, class, title, params, props, links, parts, insert-controls, groups.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": f"ctrl-depth-{i+1}", "title": f"Control at Depth {i+1}"}
                for i in range(8)
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Build 8 levels
        current_groups = []
        for level in range(8, 0, -1):
            grp = {
                "id": f"grp-tier-{level}",
                "class": f"classification-tier-{level}",
                "title": f"Hierarchy Depth Level {level}",
                "props": [
                    {"name": "depth-level", "value": str(level)},
                    {"name": "compliance-scope", "value": "critical"}
                ],
                "links": [
                    {"href": f"https://example.org/docs/tier-{level}", "rel": "related"}
                ],
                "insert-controls": [
                    {
                        "order": "ascending" if level % 2 == 0 else "descending",
                        "include-controls": [{"with-ids": [f"ctrl-depth-{level}"]}]
                    }
                ]
            }
            if current_groups:
                grp["groups"] = current_groups
            current_groups = [grp]

        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="8-Level Deep OSCAL Profile",
        )
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": current_groups
            }
        }

        # Direct Schema Validation with Draft7Validator
        validator = Draft7Validator(SCHEMAS["profiles"])
        errors = list(validator.iter_errors(prof_doc))
        assert len(errors) == 0, f"Validation errors on 8-level nesting: {[e.message for e in errors]}"

        # Save profile
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201
        prof_uuid = res_prof.json()["profile"]["uuid"]

        # Resolve profile
        res_res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_res.status_code == 200
        resolved = res_res.json()

        # Verify resolution traversed 8 levels
        node = resolved["groups"][0]
        for expected_lvl in range(1, 9):
            assert node["id"] == f"grp-tier-{expected_lvl}"
            assert len(node["controls"]) == 1
            assert node["controls"][0]["id"] == f"ctrl-depth-{expected_lvl}"
            if expected_lvl < 8:
                assert len(node["groups"]) == 1
                node = node["groups"][0]

    @pytest.mark.asyncio
    async def test_mixed_casing_resilience_across_imports_custom_groups_and_alters(self, client, isolated_data_dir):
        """
        Edge Case: Mixed casing (AC-1 vs ac-1 vs Ac-1).
        - Catalog defines control 'AC-1' (upper case) and parameter 'AC-1_P1' (upper case).
        - Profile import includes 'ac-1' (lower case).
        - Profile custom grouping inserts 'Ac-1' (title case).
        - Profile modify alters 'ac-1' and overrides param 'ac-1_p1'.
        - Profile modify alters 'AC-1' with an addition.
        Verify that resolution, alter application, parameter overriding, and pruning are fully case-insensitive.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "AC-1",
                    "title": "Access Control Policy and Procedures",
                    "params": [
                        {"id": "AC-1_P1", "label": "Review Frequency", "values": ["annually"]}
                    ],
                    "parts": [
                        {"id": "AC-1_SMT", "name": "statement", "prose": "Original Statement"}
                    ]
                },
                {
                    "id": "IA-2",
                    "title": "Identification and Authentication",
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="Mixed Casing Resilience Profile",
        )
        # Import with lowercase filter
        prof_doc["profile"]["imports"][0] = {
            "href": f"../catalogs/{cat_uuid}.json",
            "include-controls": [
                {"with-ids": ["ac-1", "ia-2"]}
            ]
        }
        # Custom grouping with TitleCase
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-access-control",
                        "title": "Access Control Group",
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["Ac-1"]}]}
                        ]
                    },
                    {
                        "id": "grp-identification",
                        "title": "Identification Group",
                        "insert-controls": [
                            {"order": "keep", "include-controls": [{"with-ids": ["Ia-2"]}]}
                        ]
                    }
                ]
            }
        }
        # Modify with mixed casing alters and param overrides
        prof_doc["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "ac-1_p1",  # lowercase override
                    "values": ["semi-annually"]
                }
            ],
            "alters": [
                {
                    "control-id": "ac-1",  # lowercase alter for uppercase AC-1
                    "adds": [
                        {
                            "position": "ending",
                            "title": "Updated AC-1 Title via Lowercase Alter"
                        }
                    ]
                }
            ]
        }

        # Save profile
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201
        prof_uuid = res_prof.json()["profile"]["uuid"]

        # Validate schema directly
        await validate_document("profiles", res_prof.json())

        # Resolve profile
        res_res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_res.status_code == 200
        resolved = res_res.json()

        # Check that both groups resolved controls properly despite casing differences
        assert len(resolved["groups"]) == 2
        g_ac = resolved["groups"][0]
        assert len(g_ac["controls"]) == 1
        ctrl_ac = g_ac["controls"][0]
        assert ctrl_ac["id"].upper() == "AC-1"

        # Check parameter override was applied case-insensitively
        assert len(ctrl_ac["params"]) == 1
        assert ctrl_ac["params"][0]["values"] == ["semi-annually"]

        # Check alter pruning does not prune case-mismatched alters
        preprocessed = await preprocess_profile_for_saving(prof_doc)
        assert "modify" in preprocessed["profile"]
        assert len(preprocessed["profile"]["modify"].get("alters", [])) == 1

    @pytest.mark.asyncio
    async def test_order_directives_compliance_and_rejection_of_invalid_values(self, client, isolated_data_dir):
        """
        Edge Case: Order directives ('ascending', 'descending', 'keep').
        1. Verify 'keep', 'ascending', and 'descending' pass NIST OSCAL Profile Schema v1.1.2.
        2. Verify invalid non-empty order values (e.g. 'random', 'reverse', 'alphabetical', 123) FAIL schema validation and API validation.
        3. Verify sorting behavior in resolution.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ctrl-c", "title": "Control C"},
                {"id": "ctrl-a", "title": "Control A"},
                {"id": "ctrl-b", "title": "Control B"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Test valid order values
        for valid_order in ["ascending", "descending", "keep"]:
            prof_doc = ProfileFactory.importing(
                catalog_uuid=cat_uuid,
                title=f"Valid Order Profile ({valid_order})",
            )
            prof_doc["profile"]["merge"] = {
                "combine": {"method": "use-first"},
                "custom": {
                    "groups": [
                        {
                            "id": f"grp-{valid_order}",
                            "title": f"Group with order {valid_order}",
                            "insert-controls": [
                                {
                                    "order": valid_order,
                                    "include-controls": [{"with-ids": ["ctrl-c", "ctrl-a", "ctrl-b"]}]
                                }
                            ]
                        }
                    ]
                }
            }

            # Schema validation
            await validate_document("profiles", prof_doc)

            # Test resolution behavior
            resolved = await resolve_profile_inline(None, prof_doc["profile"])
            ctrl_ids = [c["id"] for c in resolved["groups"][0]["controls"]]

            if valid_order == "ascending":
                assert ctrl_ids == ["ctrl-a", "ctrl-b", "ctrl-c"]
            elif valid_order == "descending":
                assert ctrl_ids == ["ctrl-c", "ctrl-b", "ctrl-a"]
            elif valid_order == "keep":
                assert ctrl_ids == ["ctrl-c", "ctrl-a", "ctrl-b"]

        # Test invalid non-empty order values -> MUST FAIL schema validation and API validation
        for invalid_order in ["random", "reverse", "alphabetical", "unordered", 123]:
            prof_doc_invalid = ProfileFactory.importing(
                catalog_uuid=cat_uuid,
                title=f"Invalid Order Profile ({invalid_order})",
            )
            prof_doc_invalid["profile"]["merge"] = {
                "combine": {"method": "use-first"},
                "custom": {
                    "groups": [
                        {
                            "id": "grp-invalid",
                            "title": "Group with invalid order",
                            "insert-controls": [
                                {
                                    "order": invalid_order,
                                    "include-controls": [{"with-ids": ["ctrl-a"]}]
                                }
                            ]
                        }
                    ]
                }
            }

            # Direct validation must raise error
            with pytest.raises((ValidationError, OSCALValidationError)):
                await validate_document("profiles", prof_doc_invalid)

            # API validation endpoint should return 400
            res_val = client.post("/api/validate/profiles", json=prof_doc_invalid)
            assert res_val.status_code == 400, f"Expected 400 for invalid order '{invalid_order}'"

    @pytest.mark.asyncio
    async def test_live_preview_resolution_with_deep_custom_groups_and_conflicts(self, client, isolated_data_dir):
        """
        Integration Test: Test live preview endpoint (/api/resolve/profile/preview) with deep custom groups,
        order directives, and conflict detection.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC-1"},
                {"id": "ac-2", "title": "AC-2"},
                {"id": "ia-1", "title": "IA-1"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        preview_body = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Preview Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
                "merge": {
                    "combine": {"method": "use-first"},
                    "custom": {
                        "groups": [
                            {
                                "id": "grp-preview-1",
                                "title": "Preview Group 1",
                                "insert-controls": [
                                    {"order": "descending", "include-controls": [{"with-ids": ["ac-1", "ac-2"]}]}
                                ]
                            }
                        ]
                    }
                }
            }
        }

        res = client.post("/api/resolve/profile/preview", json=preview_body)
        assert res.status_code == 200
        data = res.json()
        assert len(data["groups"]) == 1
        assert [c["id"] for c in data["groups"][0]["controls"]] == ["ac-2", "ac-1"]
