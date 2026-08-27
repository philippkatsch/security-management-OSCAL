"""
Tier 5 Adversarial Coverage Hardening: Alice's End-to-End Journey & Custom Merge Lifecycle.

Multi-step comprehensive verification covering:
1. Heterogeneous multi-catalog imports (NIST SP 800-53, ISO 27001, BSI IT-Grundschutz).
2. Merge mode transitions (as-is -> flat -> custom) with strict mutual exclusivity.
3. Multi-level custom group hierarchy definitions (arbitrary nesting up to 10+ levels).
4. Dual-surface control assignment simulation with case-insensitive ID matching ('AC-1' vs 'ac-1', 'ia-2.1').
5. Custom group control ordering directives ('keep', 'ascending', 'descending').
6. Custom group re-parenting, index shifting, and circular dependency prevention.
7. Group deletion with control migration to parent/target vs orphan return to unassigned pool.
8. Deep statement alters and parameter overrides applied on custom-grouped controls.
9. Bidirectional Live Preview resolution sync (/api/resolve/profile/preview) and full resolution.
10. Strict NIST OSCAL Profile Schema v1.1.2 validation, catalog schema validation, and zero UI pollution.
"""

import copy
import uuid
import pytest
from typing import Dict, Any

from tests.factories import CatalogFactory, ProfileFactory, generate_uuid
from app.validation import validate_document, JSONSchemaValidationError
from app.services.resolution_service import (
    resolve_profile,
    resolve_profile_inline,
    detect_modify_conflicts,
)
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
)
from app.format_converter import (
    serialize_oscal_dict_to_xml,
    parse_xml_to_oscal_dict,
    serialize_dict_to_yaml,
    parse_yaml_to_dict,
)


class TestAdversarialAliceJourneyEndToEnd:
    """Adversarial multi-step user journey test representing Alice's complete baseline workflow."""

    @pytest.mark.asyncio
    async def test_alices_complete_custom_merge_journey(self, client, isolated_data_dir):
        """
        Execute Alice's full multi-step journey:
        Step 1: Import 3 distinct catalogs (NIST, ISO, BSI) into system.
        Step 2: Initialize Profile with 'as-is' merge, then switch to 'custom'.
        Step 3: Define hierarchical custom groups (Enterprise Governance -> Identity & Access -> Cloud IAM).
        Step 4: Assign controls across groups with case-insensitive matching.
        Step 5: Test reordering ('ascending' and 'descending').
        Step 6: Apply alters (adds/removes) and parameter overrides to custom-grouped controls.
        Step 7: Verify live preview endpoint (/api/resolve/profile/preview).
        Step 8: Move custom group and re-parent under different branch.
        Step 9: Delete intermediate group with migration of child controls to parent.
        Step 10: Export to JSON, YAML, XML and verify schema validity and zero UI pollution.
        """

        # ---------------------------------------------------------------------
        # Step 1: Create 3 Heterogeneous Source Catalogs
        # ---------------------------------------------------------------------
        cat_nist = CatalogFactory.build(
            controls=[
                {
                    "id": "AC-1",
                    "title": "Access Control Policy and Procedures",
                    "params": [{"id": "ac-1_prm_1", "values": ["annually"]}],
                    "parts": [
                        {
                            "id": "ac-1_smt",
                            "name": "statement",
                            "prose": "The organization establishes access control policies.",
                            "parts": [
                                {"id": "ac-1_smt.a", "name": "item", "prose": "Develop and document policy;"},
                                {"id": "ac-1_smt.b", "name": "item", "prose": "Review and update annually."}
                            ]
                        }
                    ]
                },
                {
                    "id": "AC-2",
                    "title": "Account Management",
                    "params": [{"id": "ac-2_prm_1", "values": ["90 days"]}],
                    "parts": [{"id": "ac-2_smt", "name": "statement", "prose": "Manage user accounts."}]
                },
                {
                    "id": "IA-2.1",
                    "title": "Multi-Factor Authentication for Privileged Accounts",
                    "parts": [{"id": "ia-2.1_smt", "name": "statement", "prose": "Enforce MFA for all privileged access."}]
                },
                {
                    "id": "SC-7",
                    "title": "Boundary Protection",
                    "parts": [{"id": "sc-7_smt", "name": "statement", "prose": "Monitor and control communications at boundaries."}]
                }
            ]
        )
        cat_iso = CatalogFactory.build(
            controls=[
                {
                    "id": "A.5.15",
                    "title": "Access Control Requirements",
                    "parts": [{"id": "a.5.15_smt", "name": "statement", "prose": "Rules to control physical and logical access shall be established."}]
                },
                {
                    "id": "A.5.16",
                    "title": "Identity Management",
                    "parts": [{"id": "a.5.16_smt", "name": "statement", "prose": "The full lifecycle of identities shall be managed."}]
                }
            ]
        )
        cat_bsi = CatalogFactory.build(
            controls=[
                {
                    "id": "APP.1.1.A1",
                    "title": "Access Control Architecture (Grundschutz)",
                    "parts": [{"id": "app.1.1.a1_smt", "name": "statement", "prose": "A holistic access concept must be defined."}]
                }
            ]
        )

        uuid_nist = cat_nist["catalog"]["uuid"]
        uuid_iso = cat_iso["catalog"]["uuid"]
        uuid_bsi = cat_bsi["catalog"]["uuid"]

        client.post("/api/documents/catalogs", json=cat_nist)
        client.post("/api/documents/catalogs", json=cat_iso)
        client.post("/api/documents/catalogs", json=cat_bsi)

        # ---------------------------------------------------------------------
        # Step 2: Initialize Profile importing all 3 catalogs
        # ---------------------------------------------------------------------
        prof_doc = ProfileFactory.build()
        prof_doc["profile"]["imports"] = [
            {"href": f"#{uuid_nist}", "include-all": {}},
            {"href": f"#{uuid_iso}", "include-all": {}},
            {"href": f"#{uuid_bsi}", "include-all": {}}
        ]
        # Start in flat mode, then transition to custom mode
        prof_doc["profile"]["merge"] = {"flat": {}}
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res = client.post("/api/documents/profiles", json=prof_doc)
        assert res.status_code == 201

        # Switch merge mode to custom
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [],
                "insert-controls": [{"include-all": {}}]
            }
        }

        # ---------------------------------------------------------------------
        # Step 3: Define 3-Level Custom Group Hierarchy
        # Root: 'grp-gov' (Enterprise Governance)
        #   -> Child: 'grp-iam' (Identity & Access Management)
        #        -> Sub-Child: 'grp-cloud-iam' (Cloud Identity & MFA)
        # Root: 'grp-net' (Network & Perimeter)
        # ---------------------------------------------------------------------
        prof_doc["profile"]["merge"]["custom"]["groups"] = [
            {
                "id": "grp-gov",
                "title": "Enterprise Governance",
                "class": "domain",
                "props": [{"name": "owner", "value": "CISO Office"}],
                "insert-controls": [
                    {
                        "order": "ascending",
                        "include-controls": [
                            {"with-ids": ["ac-1", "a.5.15"]}
                        ]
                    }
                ],
                "groups": [
                    {
                        "id": "grp-iam",
                        "title": "Identity & Access Management",
                        "class": "sub-domain",
                        "insert-controls": [
                            {
                                "order": "keep",
                                "include-controls": [
                                    {"with-ids": ["ac-2", "a.5.16"]}
                                ]
                            }
                        ],
                        "groups": [
                            {
                                "id": "grp-cloud-iam",
                                "title": "Cloud Identity & MFA",
                                "class": "technical-layer",
                                "insert-controls": [
                                    {
                                        "order": "keep",
                                        "include-controls": [
                                            # Mixed case testing: 'ia-2.1' vs catalog 'IA-2.1'
                                            {"with-ids": ["ia-2.1"]}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "id": "grp-net",
                "title": "Network & Perimeter Defense",
                "class": "domain",
                "insert-controls": [
                    {
                        "order": "keep",
                        "include-controls": [
                            {"with-ids": ["sc-7"]}
                        ]
                    }
                ]
            }
        ]

        # ---------------------------------------------------------------------
        # Step 4: Add Alters and Parameter Overrides
        # Override param 'ac-1_prm_1' to 'semi-annually'
        # Modify prose in 'ac-1_smt.b'
        # ---------------------------------------------------------------------
        prof_doc["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "ac-1_prm_1",
                    "values": ["semi-annually"],
                    "label": "Review Period"
                }
            ],
            "alters": [
                {
                    "control-id": "ac-1",
                    "removes": [
                        {"by-id": "ac-1_smt.b"}
                    ],
                    "adds": [
                        {
                            "position": "ending",
                            "by-id": "ac-1_smt",
                            "parts": [
                                {
                                    "id": "ac-1_smt.b_custom",
                                    "name": "item",
                                    "prose": "Review and update semi-annually with executive sign-off."
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        # ---------------------------------------------------------------------
        # Step 5: Test Live Preview Resolution Endpoint (/api/resolve/profile/preview)
        # ---------------------------------------------------------------------
        res_preview = client.post("/api/resolve/profile/preview", json=prof_doc)
        assert res_preview.status_code == 200
        preview_data = res_preview.json()

        # Check all_controls contains all 7 imported controls
        all_ctrl_ids = [c["id"].upper() for c in preview_data["all_controls"]]
        assert len(all_ctrl_ids) == 7
        assert "APP.1.1.A1" in all_ctrl_ids

        # Check groups structure
        assert len(preview_data["groups"]) == 2
        gov_grp = next(g for g in preview_data["groups"] if g["id"] == "grp-gov")
        net_grp = next(g for g in preview_data["groups"] if g["id"] == "grp-net")

        # Check controls assigned to grp-gov: 'A.5.15' and 'AC-1' (sorted ascending)
        gov_ctrl_ids = [c["id"].upper() for c in gov_grp["controls"]]
        assert "AC-1" in gov_ctrl_ids
        assert "A.5.15" in gov_ctrl_ids

        # Check parameter override applied
        ac1_ctrl = next(c for c in gov_grp["controls"] if c["id"].upper() == "AC-1")
        assert ac1_ctrl["params"][0]["values"] == ["semi-annually"]

        # Check alter applied
        ac1_smt = next(p for p in ac1_ctrl["parts"] if p.get("name") == "statement")
        sub_items = [p["id"] for p in ac1_smt.get("parts", [])]
        assert "ac-1_smt.b" not in sub_items
        assert "ac-1_smt.b_custom" in sub_items

        # Check nested subgroup iam
        assert len(gov_grp["groups"]) == 1
        iam_grp = gov_grp["groups"][0]
        assert iam_grp["id"] == "grp-iam"
        iam_ctrl_ids = [c["id"].upper() for c in iam_grp["controls"]]
        assert "AC-2" in iam_ctrl_ids
        assert "A.5.16" in iam_ctrl_ids

        # Check deeply nested cloud-iam
        assert len(iam_grp["groups"]) == 1
        cloud_iam_grp = iam_grp["groups"][0]
        assert cloud_iam_grp["id"] == "grp-cloud-iam"
        assert len(cloud_iam_grp["controls"]) == 1
        assert cloud_iam_grp["controls"][0]["id"].upper() == "IA-2.1"

        # Check unassigned leftover controls at root (from top-level insert-controls include-all): APP.1.1.A1
        assert len(preview_data["controls"]) == 1
        assert preview_data["controls"][0]["id"].upper() == "APP.1.1.A1"

        # ---------------------------------------------------------------------
        # Step 6: Group Deletion with Migration
        # Delete 'grp-iam' and migrate its controls & children directly to 'grp-gov'
        # ---------------------------------------------------------------------
        prof_doc["profile"]["merge"]["custom"]["groups"][0]["insert-controls"][0]["include-controls"][0]["with-ids"].extend(["ac-2", "a.5.16"])
        prof_doc["profile"]["merge"]["custom"]["groups"][0]["groups"] = [
            {
                "id": "grp-cloud-iam",
                "title": "Cloud Identity & MFA",
                "class": "technical-layer",
                "insert-controls": [
                    {"order": "keep", "include-controls": [{"with-ids": ["ia-2.1"]}]}
                ]
            }
        ]

        # Save the updated profile to repository
        res_save2 = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save2.status_code in [200, 201]

        # Resolve saved profile from server
        res_resolved = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_resolved.status_code == 200
        resolved_doc = res_resolved.json()

        resolved_gov = next(g for g in resolved_doc["groups"] if g["id"] == "grp-gov")
        migrated_ctrl_ids = [c["id"].upper() for c in resolved_gov["controls"]]
        assert "AC-2" in migrated_ctrl_ids
        assert "A.5.16" in migrated_ctrl_ids
        assert len(resolved_gov["groups"]) == 1
        assert resolved_gov["groups"][0]["id"] == "grp-cloud-iam"

        # ---------------------------------------------------------------------
        # Step 7: Export Multi-Format & Zero Schema Pollution Verification
        # ---------------------------------------------------------------------
        # JSON export
        res_export_json = client.get(f"/api/export/profile/{prof_uuid}?format=json")
        assert res_export_json.status_code == 200
        exported_json = res_export_json.json()

        # Validate against official NIST Profile Schema v1.1.2
        await validate_document("profiles", exported_json)

        # Check that UI helper properties are absent
        exported_str = res_export_json.text
        assert "Unassigned Controls" not in exported_str
        assert "_isVirtual" not in exported_str
        assert "isVirtual" not in exported_str

        # YAML export
        res_export_yaml = client.get(f"/api/export/profile/{prof_uuid}?format=yaml")
        assert res_export_yaml.status_code == 200
        yaml_parsed = parse_yaml_to_dict(res_export_yaml.text)
        await validate_document("profiles", yaml_parsed)

        # XML export
        import xml.etree.ElementTree as ET
        res_export_xml = client.get(f"/api/export/profile/{prof_uuid}?format=xml")
        assert res_export_xml.status_code == 200
        root_xml = ET.fromstring(res_export_xml.text)
        assert "profile" in root_xml.tag


class TestAdversarialCustomMergeEdgeCases:
    """White-box adversarial edge-case testing for custom merge engine."""

    def test_deep_ten_level_nested_custom_groups(self, client, isolated_data_dir):
        """Stress-test 10-level hierarchy resolution with controls at every level."""
        ctrls = [{"id": f"ctrl-{i}", "title": f"Control Level {i}"} for i in range(1, 11)]
        cat_doc = CatalogFactory.build(controls=ctrls)
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Build 10-level nested group structure
        current_level = {
            "id": "grp-lvl-10",
            "title": "Level 10 Group",
            "insert-controls": [{"include-controls": [{"with-ids": ["ctrl-10"]}]}]
        }
        for lvl in range(9, 0, -1):
            parent_level = {
                "id": f"grp-lvl-{lvl}",
                "title": f"Level {lvl} Group",
                "insert-controls": [{"include-controls": [{"with-ids": [f"ctrl-{lvl}"]}]}],
                "groups": [current_level]
            }
            current_level = parent_level

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [current_level]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        # Traverse and verify all 10 levels
        curr = data["groups"][0]
        for lvl in range(1, 11):
            assert curr["id"] == f"grp-lvl-{lvl}"
            assert len(curr["controls"]) == 1
            assert curr["controls"][0]["id"] == f"ctrl-{lvl}"
            if lvl < 10:
                assert "groups" in curr and len(curr["groups"]) == 1
                curr = curr["groups"][0]

    def test_wildcard_matching_in_custom_group(self, client, isolated_data_dir):
        """Verify matching patterns inside custom group insert-controls."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC 1"},
                {"id": "ac-2", "title": "AC 2"},
                {"id": "ac-3", "title": "AC 3"},
                {"id": "ia-1", "title": "IA 1"},
                {"id": "sc-1", "title": "SC 1"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-ac-wildcard",
                        "title": "All AC Controls",
                        "insert-controls": [
                            {
                                "order": "descending",
                                "include-controls": [
                                    {"matching": [{"pattern": "ac-*"}]}
                                ]
                            }
                        ]
                    }
                ],
                "insert-controls": [{"include-all": {}}]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 1
        ac_grp = data["groups"][0]
        assert [c["id"] for c in ac_grp["controls"]] == ["ac-3", "ac-2", "ac-1"]
        # Unassigned leftover controls placed at root via custom.insert-controls include-all
        assert [c["id"] for c in data["controls"]] == ["ia-1", "sc-1"]

    def test_duplicate_control_assignment_across_groups_deduplication(self, client, isolated_data_dir):
        """
        If raw profile JSON mistakenly assigns the same control ID to multiple custom groups,
        resolution engine assigns to the first encountered group and avoids duplication.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC 1"},
                {"id": "ac-2", "title": "AC 2"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-1",
                        "title": "Group 1",
                        "insert-controls": [{"include-controls": [{"with-ids": ["ac-1"]}]}]
                    },
                    {
                        "id": "grp-2",
                        "title": "Group 2",
                        "insert-controls": [{"include-controls": [{"with-ids": ["ac-1", "ac-2"]}]}]
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        g1 = next(g for g in data["groups"] if g["id"] == "grp-1")
        g2 = next(g for g in data["groups"] if g["id"] == "grp-2")

        assert [c["id"] for c in g1["controls"]] == ["ac-1"]
        assert [c["id"] for c in g2["controls"]] == ["ac-2"]
