"""
Tier 3: Cross-Feature Combination End-to-End Tests (T3-01 to T3-06).
Covers multi-feature interaction: profile choice overrides with prose updating, multi-parameter control resolution,
revert-to-default fallback, constraint validation, nested group parameter inheritance, and choice synchronization.
"""

import pytest
from tests.factories import CatalogFactory, ProfileFactory
from tests.e2e.e2e_helpers import resolve_parameters, render_control_prose
from app.validation import validate_document
from app.storage import preprocess_profile_for_saving


class TestTier3CrossFeatureCombinations:
    """Tier 3: Cross-Feature Combinations (6 Test Cases)."""

    def test_t3_01_profile_override_choice_and_prose_update(self, client):
        """T3-01: Profile Override overriding Catalog Default Choice & Prose Update."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "label": "Min Length",
                            "select": {"how-many": "one", "choice": ["8", "12"]},
                            "values": ["8"],
                        }
                    ],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "ia-5_prm_1", "values": ["14"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)

        prose = "Min password length is {{ insert: param, ia-5_prm_1 }}."
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Min password length is 14."

        # Profile JSON exports clean set-parameters
        res_export = client.get(f"/api/export/profile/{prof_id}?format=json")
        exported = res_export.json()
        assert exported["profile"]["modify"]["set-parameters"][0]["values"] == ["14"]

    def test_t3_02_multi_param_control_resolution_and_schema_val(self, client):
        """T3-02: Multi-Parameter Control Resolution & Schema Validation Post-Override."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {"id": "ac-2_prm_1", "label": "frequency", "values": ["30 days"]},
                        {
                            "id": "ac-2_prm_2",
                            "label": "action",
                            "select": {"how-many": "one", "choice": ["disable", "delete"]},
                            "values": ["disable"],
                        },
                        {
                            "id": "ac-2_prm_3",
                            "label": "MFA methods",
                            "select": {
                                "how-many": "one-or-more",
                                "choice": ["token", "biometric", "sms"],
                            },
                            "values": ["token"],
                        },
                    ],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[
                {"param-id": "ac-2_prm_1", "values": ["60 days"]},
                {"param-id": "ac-2_prm_3", "values": ["token", "biometric"]},
            ],
        )
        prof_id = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profile", json=prof_doc)
        assert res_save.status_code == 201

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)

        prose = (
            "Review accounts every {{ insert: param, ac-2_prm_1 }}. "
            "Inactive action: {{ insert: param, ac-2_prm_2 }}. "
            "MFA: {{ insert: param, ac-2_prm_3 }}."
        )
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Review accounts every 60 days. Inactive action: disable. MFA: token, biometric."

        # Exported profile passes NIST schema check
        val_doc = preprocess_profile_for_saving(saved_prof, persist_local_catalog=False)
        validate_document("profiles", val_doc)

    def test_t3_03_revert_profile_override_prose_fallback(self, client):
        """T3-03: Revert Profile Override and Verify Prose Fallback."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "p1", "label": "review frequency", "values": ["30 days"]}],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "p1", "values": ["60 days"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # 1. Overridden prose renders "60 days"
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved_overridden = resolve_parameters(cat_doc, saved_prof)
        prose = "Frequency: {{ insert: param, p1 }}."
        assert render_control_prose(prose, resolved_overridden) == "Frequency: 60 days."

        # 2. Revert override
        prof_doc["profile"]["modify"]["set-parameters"] = []
        client.post("/api/documents/profile", json=prof_doc)

        saved_prof_reverted = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved_reverted = resolve_parameters(cat_doc, saved_prof_reverted)

        # 3. Immediately updates back to catalog default "30 days"
        assert render_control_prose(prose, resolved_reverted) == "Frequency: 30 days."

    def test_t3_04_profile_override_constraint_validation(self, client):
        """T3-04: Profile Parameter Override with Constraint Validation Enforcement."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {
                            "id": "p1",
                            "values": ["15"],
                            "constraints": [
                                {
                                    "tests": [
                                        {"expression": "^[0-9]{2,}$", "remarks": "Must be >= 10"}
                                    ]
                                }
                            ],
                        }
                    ],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        # Profile attempts invalid value "5"
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "p1", "values": ["5"]}],
        )
        resolved = resolve_parameters(cat_doc, prof_doc)
        p1 = resolved["p1"]
        expr = p1["constraints"][0]["tests"][0]["expression"]

        import re
        pattern = re.compile(expr)
        val = p1["values"][0]
        # Constraint validation check detects mismatch
        assert not pattern.match(val), f"Value '{val}' should fail constraint pattern '{expr}'"

    def test_t3_05_nested_group_param_inheritance_and_resolution(self, client):
        """T3-05: Nested Group Parameter Inheritance & Profile Resolution."""
        cat_doc = CatalogFactory.build(
            groups=[
                {
                    "id": "ac_group",
                    "title": "Access Control Group",
                    "params": [{"id": "grp_prm_1", "label": "Group Domain", "values": ["Internal"]}],
                    "controls": [
                        {
                            "id": "ac-1",
                            "title": "Policy",
                            "parts": [
                                {
                                    "id": "ac-1_smt",
                                    "prose": "Policy for {{ insert: param, grp_prm_1 }}.",
                                }
                            ],
                        },
                        {
                            "id": "ac-2",
                            "title": "Accounts",
                            "parts": [
                                {
                                    "id": "ac-2_smt",
                                    "prose": "Accounts in {{ insert: param, grp_prm_1 }}.",
                                }
                            ],
                        },
                    ],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        # Profile overrides group-level param
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "grp_prm_1", "values": ["Enterprise"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)

        prose1 = "Policy for {{ insert: param, grp_prm_1 }}."
        prose2 = "Accounts in {{ insert: param, grp_prm_1 }}."

        # Both controls AC-1 and AC-2 render updated override value "Enterprise"
        assert render_control_prose(prose1, resolved) == "Policy for Enterprise."
        assert render_control_prose(prose2, resolved) == "Accounts in Enterprise."

    def test_t3_06_catalog_choice_mod_and_profile_sync(self, client):
        """T3-06: Catalog Choice Modification & Profile Override Synchronization."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control",
                    "params": [
                        {
                            "id": "p1",
                            "select": {"how-many": "one", "choice": ["A", "B"]},
                            "values": ["A"],
                        }
                    ],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "p1", "values": ["B"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # Catalog choice updated to ["A", "B", "C"]
        cat_doc["catalog"]["controls"][0]["params"][0]["select"]["choice"] = ["A", "B", "C"]
        client.post("/api/documents/catalog", json=cat_doc)

        saved_cat = client.get(f"/api/documents/catalog/{cat_id}").json()
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()

        resolved = resolve_parameters(saved_cat, saved_prof)
        p1_resolved = resolved["p1"]
        # Profile override "B" remains valid
        assert p1_resolved["values"] == ["B"]
        # Choices list is updated to ["A", "B", "C"]
        assert p1_resolved["select"]["choice"] == ["A", "B", "C"]
