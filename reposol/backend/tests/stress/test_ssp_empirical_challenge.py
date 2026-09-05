"""
Empirical Challenger: Step 4 NIST OSCAL SSP Backend Verification Suite

This stress and challenge suite rigorously stress-tests:
- Challenge 1: Multi-tier parameter cascade precedence & deep prose placeholder substitution
- Challenge 2: Direct catalog baseline vs Profile baseline resolution under edge-case conditions
- Challenge 3: Strict NIST OSCAL SSP Schema v1.2.2 validation with boundary & adversarial edge cases
"""
import uuid
import copy
import json
import pytest
from typing import Dict, Any, List
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator

from app.validation import validate_document, SCHEMAS, OSCALValidationError
from app.services.resolution_service import (
    resolve_ssp,
    resolve_ssp_inline,
    _run_ssp_resolution_pipeline,
    _substitute_prose_params,
    _substitute_parts_prose,
    _collect_withdrawn_ids,
)
from tests.factories import SSPFactory, ProfileFactory, CatalogFactory, generate_uuid


# =============================================================================
# CHALLENGE 1: MULTI-TIER PARAMETER CASCADE & DEEP PLACEHOLDER SUBSTITUTIONS
# =============================================================================

class TestParameterCascadeEmpirical:
    """Rigorous empirical tests for 4-tier parameter cascade precedence and prose placeholder replacements."""

    def test_full_5_tier_cascade_collision(self, client: TestClient):
        """
        Adversarially tests all 5 parameter sources competing on the exact same parameter ID:
        1. Catalog Parameter Definition default
        2. Profile Baseline Parameter Override (modify.set-parameters)
        3. SSP Global Parameter Override (control-implementation.set-parameters)
        4. Control-Level Parameter Override (implemented-requirements.set-parameters)
        5. Component-Level Parameter Override (by-components.set-parameters)
        """
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.build(
            doc_id=cat_id,
            title="Cascade Baseline Catalog",
            params=[
                {"id": "prm_shared", "values": ["tier5_catalog_default"], "label": "Shared Parameter"}
            ],
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {"id": "prm_shared", "values": ["tier5_catalog_default"]}
                    ],
                    "parts": [
                        {
                            "id": "ac-1_smt",
                            "name": "statement",
                            "prose": "Policy interval is {{ insert: param, prm_shared }}."
                        }
                    ]
                }
            ]
        )
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile override
        prof_id = str(uuid.uuid4())
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            doc_id=prof_id,
            title="Cascade Profile",
            set_parameters=[
                {"param-id": "prm_shared", "values": ["tier4_profile_override"]}
            ]
        )
        client.post("/api/documents/profiles", json=prof_doc)

        this_system_uuid = str(uuid.uuid4())

        # Test Case 1: Only Profile Baseline (Tier 4)
        ssp_t4_id = str(uuid.uuid4())
        ssp_t4 = SSPFactory.build(
            doc_id=ssp_t4_id,
            profile_uuid=prof_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Tier 4 test",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl"}]
                    }
                ]
            }
        )
        save_t4 = client.post("/api/documents/ssps", json=ssp_t4)
        assert save_t4.status_code == 201
        res_t4 = client.get(f"/api/resolve/ssp/{ssp_t4_id}").json()
        p_t4 = {p["param-id"].lower(): p for p in res_t4["control_tree"]["controls"][0]["resolved_parameters"]}
        assert p_t4["prm_shared"]["effective_values"] == ["tier4_profile_override"]
        assert p_t4["prm_shared"]["origin"] in ("baseline-default", "catalog-default")
        assert "tier4_profile_override" in res_t4["control_tree"]["controls"][0]["parts"][0]["prose"]

        # Test Case 2: SSP Global Override (Tier 3) beats Profile Baseline (Tier 4)
        ssp_t3_id = str(uuid.uuid4())
        ssp_t3 = SSPFactory.build(
            doc_id=ssp_t3_id,
            profile_uuid=prof_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Tier 3 test",
                "set-parameters": [
                    {"param-id": "prm_shared", "values": ["tier3_ssp_global"]}
                ],
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl"}]
                    }
                ]
            }
        )
        save_t3 = client.post("/api/documents/ssps", json=ssp_t3)
        assert save_t3.status_code == 201
        res_t3 = client.get(f"/api/resolve/ssp/{ssp_t3_id}").json()
        p_t3 = {p["param-id"].lower(): p for p in res_t3["control_tree"]["controls"][0]["resolved_parameters"]}
        assert p_t3["prm_shared"]["effective_values"] == ["tier3_ssp_global"]
        assert p_t3["prm_shared"]["origin"] == "ssp-global"
        assert "tier3_ssp_global" in res_t3["control_tree"]["controls"][0]["parts"][0]["prose"]

        # Test Case 3: Control-Level Override (Tier 2) beats SSP Global (Tier 3)
        ssp_t2_id = str(uuid.uuid4())
        ssp_t2 = SSPFactory.build(
            doc_id=ssp_t2_id,
            profile_uuid=prof_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Tier 2 test",
                "set-parameters": [
                    {"param-id": "prm_shared", "values": ["tier3_ssp_global"]}
                ],
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "set-parameters": [
                            {"param-id": "prm_shared", "values": ["tier2_control_override"]}
                        ],
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl"}]
                    }
                ]
            }
        )
        save_t2 = client.post("/api/documents/ssps", json=ssp_t2)
        assert save_t2.status_code == 201
        res_t2 = client.get(f"/api/resolve/ssp/{ssp_t2_id}").json()
        p_t2 = {p["param-id"].lower(): p for p in res_t2["control_tree"]["controls"][0]["resolved_parameters"]}
        assert p_t2["prm_shared"]["effective_values"] == ["tier2_control_override"]
        assert p_t2["prm_shared"]["origin"] == "control-override"
        assert "tier2_control_override" in res_t2["control_tree"]["controls"][0]["parts"][0]["prose"]

        # Test Case 4: Component-Level Override (Tier 1) recorded in parameters.component_level
        ssp_t1_id = str(uuid.uuid4())
        ssp_t1 = SSPFactory.build(
            doc_id=ssp_t1_id,
            profile_uuid=prof_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Tier 1 test",
                "set-parameters": [{"param-id": "prm_shared", "values": ["tier3_ssp_global"]}],
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "set-parameters": [{"param-id": "prm_shared", "values": ["tier2_control_override"]}],
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": this_system_uuid,
                                "description": "Impl",
                                "set-parameters": [{"param-id": "prm_shared", "values": ["tier1_comp_override"]}]
                            }
                        ]
                    }
                ]
            }
        )
        save_t1 = client.post("/api/documents/ssps", json=ssp_t1)
        assert save_t1.status_code == 201
        res_t1 = client.get(f"/api/resolve/ssp/{ssp_t1_id}").json()
        comp_params = res_t1["parameters"]["component_level"]["ac-1"]
        comp_key = f"{this_system_uuid.lower()}:prm_shared"
        assert comp_key in comp_params
        assert comp_params[comp_key]["values"] == ["tier1_comp_override"]
        assert comp_params[comp_key]["origin"] == "component-override"

    def test_statement_level_component_parameter_override(self, client: TestClient):
        """Test statement-level component set-parameters indexing in cascade tree."""
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.build(
            doc_id=cat_id,
            title="Statement Cascade Catalog",
            controls=[
                {
                    "id": "ia-2",
                    "title": "Identification and Authentication",
                    "params": [{"id": "ia-2_prm_1", "values": ["default_val"]}],
                    "parts": [
                        {
                            "id": "ia-2_smt",
                            "name": "statement",
                            "prose": "MFA statement",
                            "parts": [
                                {"id": "ia-2_smt.a", "name": "item", "prose": "MFA for admins"}
                            ]
                        }
                    ]
                }
            ]
        )
        client.post("/api/documents/catalogs", json=cat_doc)

        this_system_uuid = str(uuid.uuid4())
        ssp_id = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            doc_id=ssp_id,
            catalog_uuid=cat_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Statement cascade",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ia-2",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Top"}],
                        "statements": [
                            {
                                "statement-id": "ia-2_smt.a",
                                "uuid": str(uuid.uuid4()),
                                "by-components": [
                                    {
                                        "uuid": str(uuid.uuid4()),
                                        "component-uuid": this_system_uuid,
                                        "description": "Statement level impl",
                                        "set-parameters": [
                                            {"param-id": "ia-2_prm_1", "values": ["smart_cards", "fido2_keys"]}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        )
        save_res = client.post("/api/documents/ssps", json=ssp_doc)
        assert save_res.status_code == 201
        res = client.get(f"/api/resolve/ssp/{ssp_id}").json()
        comp_params = res["parameters"]["component_level"]["ia-2"]
        stmt_comp_key = f"{this_system_uuid.lower()}:ia-2_smt.a:ia-2_prm_1"
        assert stmt_comp_key in comp_params
        assert comp_params[stmt_comp_key]["values"] == ["smart_cards", "fido2_keys"]
        assert comp_params[stmt_comp_key]["statement-id"] == "ia-2_smt.a"

    def test_multi_value_parameter_array_joining(self):
        """Test that multiple parameter values are joined with comma separation in prose."""
        text = "Authorized methods are: {{ insert: param, auth_methods }}."
        param_map = {"auth_methods": ["Password", "SMS OTP", "FIDO2 Key"]}
        substituted = _substitute_prose_params(text, param_map)
        assert substituted == "Authorized methods are: Password, SMS OTP, FIDO2 Key."

    def test_zero_and_boolean_parameter_values(self):
        """Test that '0', 'false', and numeric strings are not treated as falsy or omitted."""
        text = "Retention is {{ insert: param, p_days }} days with fallback {{ insert: param, p_flag }}."
        param_map = {
            "p_days": ["0"],
            "p_flag": ["false"]
        }
        substituted = _substitute_prose_params(text, param_map)
        assert substituted == "Retention is 0 days with fallback false."

    def test_prose_placeholder_syntax_variations(self):
        """Test whitespace tolerance, XML forms, and case insensitivity in parameter substitution."""
        text = (
            "Standard: {{ insert: param, p1 }}; "
            "Spaces: {{   insert:   param   ,   p2   }}; "
            "XML self-closing: <insert type=\"param\" id-ref=\"p3\" />; "
            "XML paired: <insert type=\"param\" id-ref=\"p4\"></insert>; "
            "XML single quotes: <insert type='param' id-ref='p5' />"
        )
        param_map = {
            "P1": ["V1"],
            "p2": ["V2"],
            "P3": ["V3"],
            "p4": ["V4"],
            "P5": ["V5"]
        }
        substituted = _substitute_prose_params(text, param_map)
        assert "Standard: V1" in substituted
        assert "Spaces: V2" in substituted
        assert "XML self-closing: V3" in substituted
        assert "XML paired: V4" in substituted
        assert "XML single quotes: V5" in substituted

    def test_unresolved_missing_parameter_leaves_placeholder(self):
        """Test that placeholders without parameter values remain untouched without crashing."""
        text = "Requirement: {{ insert: param, missing_param_123 }} must be fulfilled."
        param_map = {"existing_param": ["value"]}
        substituted = _substitute_prose_params(text, param_map)
        assert substituted == text

    def test_deeply_nested_parts_prose_substitution(self):
        """Test that parameter substitutions reach deep 5-level nested parts."""
        parts = [
            {
                "id": "p_1",
                "name": "statement",
                "prose": "Level 1: {{ insert: param, p1 }}",
                "parts": [
                    {
                        "id": "p_2",
                        "name": "item",
                        "prose": "Level 2: {{ insert: param, p2 }}",
                        "parts": [
                            {
                                "id": "p_3",
                                "name": "subitem",
                                "prose": "Level 3: {{ insert: param, p3 }}",
                                "parts": [
                                    {
                                        "id": "p_4",
                                        "name": "subsubitem",
                                        "prose": "Level 4: {{ insert: param, p4 }}"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        param_map = {
            "p1": ["Val1"],
            "p2": ["Val2"],
            "p3": ["Val3"],
            "p4": ["Val4"]
        }
        substituted = _substitute_parts_prose(parts, param_map)
        assert substituted[0]["prose"] == "Level 1: Val1"
        assert substituted[0]["parts"][0]["prose"] == "Level 2: Val2"
        assert substituted[0]["parts"][0]["parts"][0]["prose"] == "Level 3: Val3"
        assert substituted[0]["parts"][0]["parts"][0]["parts"][0]["prose"] == "Level 4: Val4"


# =============================================================================
# CHALLENGE 2: BASELINE RESOLUTION UNDER EDGE-CASE CONDITIONS
# =============================================================================

class TestBaselineResolutionEmpirical:
    """Rigorous empirical tests for catalog vs profile baseline resolution, withdrawn controls, and edge cases."""

    def test_catalog_vs_profile_baseline_parity(self, client: TestClient):
        """
        Verify that resolving an SSP against a direct Catalog baseline produces
        exact parity with resolving against a Profile that imports that Catalog.
        """
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.build(
            doc_id=cat_id,
            title="Parity Source Catalog",
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": ["annual"]}],
                    "parts": [{"id": "ac-1_smt", "name": "statement", "prose": "Review {{ insert: param, ac-1_prm_1 }}."}]
                },
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "parts": [{"id": "ac-2_smt", "name": "statement", "prose": "Manage user accounts."}]
                }
            ]
        )
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_id = str(uuid.uuid4())
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_id, doc_id=prof_id, title="Parity Profile")
        client.post("/api/documents/profiles", json=prof_doc)

        this_system_uuid = str(uuid.uuid4())

        # SSP A: Direct Catalog
        ssp_cat_id = str(uuid.uuid4())
        ssp_cat = SSPFactory.build(
            doc_id=ssp_cat_id,
            catalog_uuid=cat_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Impl",
                "implemented-requirements": [
                    {"uuid": str(uuid.uuid4()), "control-id": "ac-1", "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D1", "implementation-status": {"state": "implemented"}}]}
                ]
            }
        )
        save_cat = client.post("/api/documents/ssps", json=ssp_cat)
        assert save_cat.status_code == 201

        # SSP B: Profile
        ssp_prof_id = str(uuid.uuid4())
        ssp_prof = SSPFactory.build(
            doc_id=ssp_prof_id,
            profile_uuid=prof_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Impl",
                "implemented-requirements": [
                    {"uuid": str(uuid.uuid4()), "control-id": "ac-1", "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "D1", "implementation-status": {"state": "implemented"}}]}
                ]
            }
        )
        save_prof = client.post("/api/documents/ssps", json=ssp_prof)
        assert save_prof.status_code == 201

        res_cat = client.get(f"/api/resolve/ssp/{ssp_cat_id}").json()
        res_prof = client.get(f"/api/resolve/ssp/{ssp_prof_id}").json()

        # Both must have 2 controls total, 1 implemented
        assert res_cat["implementation_summary"]["total"] == res_prof["implementation_summary"]["total"] == 2
        assert res_cat["implementation_summary"]["implemented"] == res_prof["implementation_summary"]["implemented"] == 1
        assert len(res_cat["control_tree"]["controls"]) == len(res_prof["control_tree"]["controls"]) == 2

    def test_withdrawn_controls_auto_excluded_from_direct_catalog(self, client: TestClient):
        """
        Verify that deprecated / withdrawn controls in a direct Catalog baseline
        (controls with status=withdrawn or state=withdrawn) are excluded automatically.
        """
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.build(
            doc_id=cat_id,
            title="Catalog with Deprecated Controls",
            controls=[
                {"id": "ctrl-active-1", "title": "Active Control 1"},
                {
                    "id": "ctrl-withdrawn-status",
                    "title": "Withdrawn by Status Prop",
                    "props": [{"name": "status", "value": "withdrawn"}]
                },
                {
                    "id": "ctrl-withdrawn-state",
                    "title": "Withdrawn by State Prop",
                    "props": [{"name": "state", "value": "withdrawn"}]
                }
            ],
            groups=[
                {
                    "id": "grp-1",
                    "title": "Group 1",
                    "controls": [
                        {"id": "grp-ctrl-active", "title": "Group Active Control"},
                        {
                            "id": "grp-ctrl-withdrawn",
                            "title": "Group Withdrawn Control",
                            "props": [{"name": "status", "value": "withdrawn"}]
                        }
                    ]
                }
            ]
        )
        client.post("/api/documents/catalogs", json=cat_doc)

        this_system_uuid = str(uuid.uuid4())
        ssp_id = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            doc_id=ssp_id,
            catalog_uuid=cat_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Impl for active controls",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ctrl-active-1",
                        "by-components": [
                            {"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Active impl"}
                        ]
                    }
                ]
            }
        )
        save_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert save_ssp.status_code == 201

        res = client.get(f"/api/resolve/ssp/{ssp_id}").json()
        flat_ctrl_ids = []
        for c in res["control_tree"]["controls"]:
            flat_ctrl_ids.append(c["id"])
        for g in res["control_tree"]["groups"]:
            for c in g.get("controls", []):
                flat_ctrl_ids.append(c["id"])

        assert "ctrl-active-1" in flat_ctrl_ids
        assert "grp-ctrl-active" in flat_ctrl_ids
        assert "ctrl-withdrawn-status" not in flat_ctrl_ids
        assert "ctrl-withdrawn-state" not in flat_ctrl_ids
        assert "grp-ctrl-withdrawn" not in flat_ctrl_ids
        assert res["implementation_summary"]["total"] == 2

    def test_back_matter_resource_href_resolution(self, client: TestClient):
        """
        Verify that an SSP with `import-profile.href="#res-uuid"` resolves
        by following `back-matter.resources` to find the target catalog/profile.
        """
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.with_controls(doc_id=cat_id, title="Back-Matter Target Catalog")
        client.post("/api/documents/catalogs", json=cat_doc)

        resource_uuid = str(uuid.uuid4())
        this_system_uuid = str(uuid.uuid4())
        ssp_id = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            doc_id=ssp_id,
            title="Back-Matter Href SSP",
            import_profile_href=f"#{resource_uuid}",
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Impl",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [
                            {"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Impl"}
                        ]
                    }
                ]
            },
            back_matter={
                "resources": [
                    {
                        "uuid": resource_uuid,
                        "title": "Embedded Baseline Resource Reference",
                        "rlinks": [
                            {"href": f"/api/documents/catalogs/{cat_id}"}
                        ]
                    }
                ]
            }
        )
        save_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert save_ssp.status_code == 201

        res = client.get(f"/api/resolve/ssp/{ssp_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["source_baseline"]["type"] == "catalog"
        assert data["source_baseline"]["id"] == cat_id
        assert data["implementation_summary"]["total"] >= 2

    def test_missing_baseline_graceful_handling(self, client: TestClient):
        """Verify that an SSP with non-existent baseline resolves gracefully to empty tree."""
        missing_id = str(uuid.uuid4())
        this_system_uuid = str(uuid.uuid4())
        ssp_id = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            doc_id=ssp_id,
            title="Missing Baseline SSP",
            profile_uuid=missing_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            }
        )
        # Bypassing validate_document check by inline resolver
        res = client.post("/api/resolve/ssp/preview", json=ssp_doc)
        assert res.status_code == 200
        data = res.json()
        assert data["source_baseline"]["type"] == "none"
        assert data["control_tree"]["controls"] == []
        assert data["control_tree"]["groups"] == []
        assert data["implementation_summary"]["total"] == 0

    def test_deeply_nested_groups_resolution(self, client: TestClient):
        """Verify resolution and annotation of 4-level nested control group hierarchies."""
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.build(
            doc_id=cat_id,
            title="Nested Groups Catalog",
            groups=[
                {
                    "id": "g1",
                    "title": "Level 1",
                    "groups": [
                        {
                            "id": "g2",
                            "title": "Level 2",
                            "groups": [
                                {
                                    "id": "g3",
                                    "title": "Level 3",
                                    "controls": [
                                        {"id": "ctrl-nested-1", "title": "Nested Control"}
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        )
        client.post("/api/documents/catalogs", json=cat_doc)

        this_system_uuid = str(uuid.uuid4())
        ssp_id = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            doc_id=ssp_id,
            catalog_uuid=cat_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Nested impl",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ctrl-nested-1",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Deeply implemented", "implementation-status": {"state": "implemented"}}]
                    }
                ]
            }
        )
        save_res = client.post("/api/documents/ssps", json=ssp_doc)
        assert save_res.status_code == 201

        res = client.get(f"/api/resolve/ssp/{ssp_id}").json()
        assert res["implementation_summary"]["total"] == 1
        assert res["implementation_summary"]["implemented"] == 1
        lvl3 = res["control_tree"]["groups"][0]["groups"][0]["groups"][0]
        assert lvl3["controls"][0]["id"] == "ctrl-nested-1"
        assert lvl3["controls"][0]["implementation_status"] == "implemented"


# =============================================================================
# CHALLENGE 3: STRICT NIST OSCAL SSP SCHEMA v1.2.2 VALIDATION & ADVERSARIAL CASES
# =============================================================================

class TestSSPSchemaValidationEmpirical:
    """Rigorous empirical tests for strict NIST OSCAL SSP JSON Schema v1.2.2 compliance."""

    @pytest.mark.asyncio
    async def test_positive_full_spectrum_ssp_document(self):
        """
        Verify that a complete, multi-assembly SSP document containing all standard
        assemblies strictly validates against oscal_ssp_schema.json without errors.
        """
        this_system_uuid = generate_uuid()
        doc = SSPFactory.build(
            title="Comprehensive FedRAMP Moderate Cloud SSP",
            system_characteristics={
                "system-name": "Enterprise Cloud Operations",
                "system-name-short": "ECOP",
                "description": "Primary enterprise workload boundary",
                "system-ids": [
                    {"id": "ECOP-SYS-001", "identifier-type": "https://fedramp.gov"}
                ],
                "security-sensitivity-level": "moderate",
                "system-information": {
                    "information-types": [
                        {
                            "uuid": generate_uuid(),
                            "title": "System and Network Monitoring Data",
                            "description": "Telemetry and security logs",
                            "categorizations": [
                                {
                                    "system": "http://doi.org/10.6028/NIST.SP.800-60v2r1",
                                    "information-type-ids": ["C.3.5.8"]
                                }
                            ],
                            "confidentiality-impact": {"base": "moderate"},
                            "integrity-impact": {"base": "moderate"},
                            "availability-impact": {"base": "low"}
                        }
                    ]
                },
                "security-impact-level": {
                    "security-objective-confidentiality": "moderate",
                    "security-objective-integrity": "moderate",
                    "security-objective-availability": "low"
                },
                "status": {
                    "state": "operational",
                    "remarks": "Fully operational in production."
                },
                "authorization-boundary": {
                    "description": "Boundary encompasses all AWS us-east-1 VPCs and Kubernetes clusters.",
                    "diagrams": [
                        {
                            "uuid": generate_uuid(),
                            "description": "High level architecture diagram",
                            "links": [{"href": "#diag-res-1", "rel": "diagram"}]
                        }
                    ]
                }
            },
            system_implementation={
                "users": [
                    {
                        "uuid": generate_uuid(),
                        "title": "Lead Security Engineer",
                        "role-ids": ["provider", "security-operations"],
                        "authorized-privileges": [
                            {
                                "title": "Full Admin Access",
                                "functions-performed": ["Configure SIEM", "Manage Keys"]
                            }
                        ]
                    }
                ],
                "components": [
                    {
                        "uuid": this_system_uuid,
                        "type": "this-system",
                        "title": "ECOP System",
                        "description": "Root system component",
                        "status": {"state": "operational"}
                    },
                    {
                        "uuid": generate_uuid(),
                        "type": "service",
                        "title": "Authentication Microservice",
                        "description": "OAuth2 / OIDC token issuer",
                        "status": {"state": "operational"},
                        "protocols": [
                            {
                                "uuid": generate_uuid(),
                                "name": "HTTPS",
                                "title": "Secure HTTP",
                                "port-ranges": [{"start": 443, "end": 443, "transport": "TCP"}]
                            }
                        ]
                    }
                ],
                "leveraged-authorizations": [
                    {
                        "uuid": generate_uuid(),
                        "title": "AWS GovCloud FedRAMP High Authorization",
                        "party-uuid": generate_uuid(),
                        "date-authorized": "2025-01-01"
                    }
                ],
                "inventory-items": [
                    {
                        "uuid": generate_uuid(),
                        "description": "Worker Node 01",
                        "implemented-components": [{"component-uuid": generate_uuid()}]
                    }
                ]
            },
            control_implementation={
                "description": "Control implementation matrix",
                "set-parameters": [
                    {"param-id": "global_session_timeout", "values": ["15_minutes"]}
                ],
                "implemented-requirements": [
                    {
                        "uuid": generate_uuid(),
                        "control-id": "ac-1",
                        "by-components": [
                            {
                                "uuid": generate_uuid(),
                                "component-uuid": this_system_uuid,
                                "description": "Access control procedures reviewed annually.",
                                "implementation-status": {"state": "implemented"}
                            }
                        ]
                    }
                ]
            }
        )
        # Must pass schema validation without raising OSCALValidationError
        await validate_document("ssps", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("injection_path,bad_payload", [
        # additionalProperties on root system-security-plan
        (["system-security-plan", "extra_root_prop"], "disallowed_value"),
        # additionalProperties on system-characteristics
        (["system-security-plan", "system-characteristics", "custom_attribute"], 12345),
        # additionalProperties on components[0]
        (["system-security-plan", "system-implementation", "components", 0, "legacy_status"], "active"),
        # additionalProperties on implemented-requirements[0]
        (["system-security-plan", "control-implementation", "implemented-requirements", 0, "non_standard_field"], True),
        # additionalProperties on by-components[0]
        (["system-security-plan", "control-implementation", "implemented-requirements", 0, "by-components", 0, "audit_flag"], "fail"),
    ])
    async def test_additional_properties_forbidden_violations(self, injection_path, bad_payload):
        """
        Adversarially probe that additionalProperties: false is strictly enforced
        at root, system-characteristics, components, implemented-requirements, and by-components.
        """
        doc = SSPFactory.minimal()
        target = doc
        for key in injection_path[:-1]:
            target = target[key]
        target[injection_path[-1]] = bad_payload

        with pytest.raises((OSCALValidationError, Exception)):
            await validate_document("ssps", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("empty_array_path", [
        ["system-security-plan", "system-characteristics", "system-ids"],
        ["system-security-plan", "system-implementation", "users"],
        ["system-security-plan", "system-implementation", "components"],
        ["system-security-plan", "control-implementation", "implemented-requirements"],
        ["system-security-plan", "control-implementation", "implemented-requirements", 0, "by-components"],
    ])
    async def test_empty_arrays_fail_min_items_constraint(self, empty_array_path):
        """
        Verify that empty arrays [] for required collections violate minItems: 1
        per NIST OSCAL JSON schema rules (DD-014 empty array purging requirement).
        """
        doc = SSPFactory.minimal()
        target = doc
        for key in empty_array_path[:-1]:
            target = target[key]
        target[empty_array_path[-1]] = []

        with pytest.raises((OSCALValidationError, Exception)):
            await validate_document("ssps", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("missing_required_key", [
        "uuid",
        "metadata",
        "import-profile",
        "system-characteristics",
        "system-implementation",
        "control-implementation"
    ])
    async def test_missing_root_level_required_fields_fail(self, missing_required_key):
        """Verify that omitting any root required key fails schema validation."""
        doc = SSPFactory.minimal()
        del doc["system-security-plan"][missing_required_key]

        with pytest.raises((OSCALValidationError, Exception)):
            await validate_document("ssps", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("missing_meta_key", [
        "title",
        "last-modified",
        "version",
        "oscal-version"
    ])
    async def test_missing_metadata_required_fields_fail(self, missing_meta_key):
        """Verify that omitting metadata required keys fails schema validation."""
        doc = SSPFactory.minimal()
        del doc["system-security-plan"]["metadata"][missing_meta_key]

        with pytest.raises((OSCALValidationError, Exception)):
            await validate_document("ssps", doc, check_refs=False)

    def test_cross_reference_invalid_by_component_uuid_rejected(self, client: TestClient):
        """Verify that a by-component referencing a non-existent UUID is rejected by the validation route."""
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.with_controls(doc_id=cat_id)
        client.post("/api/documents/catalogs", json=cat_doc)

        non_existent_comp_uuid = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            catalog_uuid=cat_id,
            control_implementation={
                "description": "Control impl",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "component-uuid": non_existent_comp_uuid,
                                "description": "Invalid component linkage."
                            }
                        ]
                    }
                ]
            }
        )

        res = client.post("/api/validate/ssps", json=ssp_doc)
        assert res.status_code == 400
        assert "Referenced component" in res.text

    def test_cross_reference_duplicate_control_ids_rejected(self, client: TestClient):
        """Verify that duplicate control-ids in implemented-requirements are rejected."""
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.with_controls(doc_id=cat_id)
        client.post("/api/documents/catalogs", json=cat_doc)

        this_system_uuid = str(uuid.uuid4())
        ssp_doc = SSPFactory.build(
            catalog_uuid=cat_id,
            system_implementation={
                "users": [{"uuid": str(uuid.uuid4()), "title": "Admin", "role-ids": ["provider"]}],
                "components": [{"uuid": this_system_uuid, "type": "this-system", "title": "Sys", "description": "Sys", "status": {"state": "operational"}}]
            },
            control_implementation={
                "description": "Control impl",
                "implemented-requirements": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "First"}]
                    },
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1",  # Duplicate control-id
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": this_system_uuid, "description": "Second"}]
                    }
                ]
            }
        )

        res = client.post("/api/validate/ssps", json=ssp_doc)
        assert res.status_code == 400
        assert "Duplicate control-id" in res.text

    def test_validation_route_stage_aliases_parity(self, client: TestClient):
        """Verify both /api/validate/ssps and /api/validate/system-security-plans function identically."""
        cat_id = str(uuid.uuid4())
        cat_doc = CatalogFactory.with_controls(doc_id=cat_id)
        client.post("/api/documents/catalogs", json=cat_doc)

        ssp_doc = SSPFactory.build(catalog_uuid=cat_id)

        res_ssps = client.post("/api/validate/ssps", json=ssp_doc)
        assert res_ssps.status_code == 200
        assert res_ssps.json().get("status") == "valid"

        res_full_alias = client.post("/api/validate/system-security-plans", json=ssp_doc)
        assert res_full_alias.status_code == 200
        assert res_full_alias.json().get("status") == "valid"
