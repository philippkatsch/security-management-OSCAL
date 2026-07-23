"""
Tier 1: Feature Coverage End-to-End Tests (T1-F1-01 to T1-F5-05).
Covers core parameter value assignment, choice selection, profile overrides, prose rendering, and export/import serialization.
"""

import pytest
from tests.factories import CatalogFactory, ProfileFactory, generate_uuid
from tests.e2e.e2e_helpers import resolve_parameters, render_control_prose
from app.validation import validate_document


class TestTier1FeatureCoverage:
    """Tier 1: Feature Coverage (25 Test Cases)."""

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F1: Catalog Stage 1 Free-Text Value Assignment (values[])
    # ─────────────────────────────────────────────────────────────────────────

    def test_t1_f1_01_assign_single_free_text_value(self, client):
        """T1-F1-01: Assign single free-text parameter value in catalog."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {
                            "id": "ac-1_prm_1",
                            "label": "policy review frequency",
                            "values": ["30 days"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res_post = client.post("/api/documents/catalog", json=doc)
        assert res_post.status_code == 201

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        param = saved_doc["catalog"]["controls"][0]["params"][0]
        assert param["id"] == "ac-1_prm_1"
        assert param["values"] == ["30 days"]

    def test_t1_f1_02_update_existing_free_text_value(self, client):
        """T1-F1-02: Update existing free-text parameter value in catalog."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {
                            "id": "ac-1_prm_1",
                            "values": ["30 days"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        # Update values from "30 days" to "60 days"
        doc["catalog"]["controls"][0]["params"][0]["values"] = ["60 days"]
        res_put = client.post("/api/documents/catalog", json=doc)
        assert res_put.status_code == 200

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        assert saved_doc["catalog"]["controls"][0]["params"][0]["values"] == ["60 days"]

    def test_t1_f1_03_assign_multiple_values(self, client):
        """T1-F1-03: Assign multiple values to a multi-value parameter."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {
                            "id": "ac-2_prm_1",
                            "label": "Authorized Account Manager Roles",
                            "values": ["Admin", "Operator", "Auditor"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        saved_param = res_get.json()["catalog"]["controls"][0]["params"][0]
        assert saved_param["values"] == ["Admin", "Operator", "Auditor"]
        assert len(saved_param["values"]) == 3

    def test_t1_f1_04_assign_numeric_string_value(self, client):
        """T1-F1-04: Assign numeric string as parameter value."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "label": "Minimum Password Length",
                            "values": ["12"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        saved_param = res_get.json()["catalog"]["controls"][0]["params"][0]
        assert saved_param["values"] == ["12"]
        assert isinstance(saved_param["values"][0], str)

    def test_t1_f1_05_set_label_and_usage(self, client):
        """T1-F1-05: Set parameter label and usage alongside free-text value."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-7",
                    "title": "Unsuccessful Logon Attempts",
                    "params": [
                        {
                            "id": "ac-7_prm_1",
                            "label": "Lockout Threshold",
                            "usage": "Number of failed attempts allowed before account lockout",
                            "values": ["5"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        saved_param = res_get.json()["catalog"]["controls"][0]["params"][0]
        assert saved_param["label"] == "Lockout Threshold"
        assert saved_param["usage"] == "Number of failed attempts allowed before account lockout"
        assert saved_param["values"] == ["5"]

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F2: Catalog Stage 1 Choice Selection (select.choice)
    # ─────────────────────────────────────────────────────────────────────────

    def test_t1_f2_01_select_single_choice(self, client):
        """T1-F2-01: Select single choice from predefined choice[] list."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "label": "Password Length",
                            "select": {
                                "how-many": "one",
                                "choice": ["8", "12", "16"],
                            },
                            "values": ["12"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        param = res_get.json()["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["12"]
        assert param["select"]["how-many"] == "one"
        assert param["select"]["choice"] == ["8", "12", "16"]

    def test_t1_f2_02_select_multiple_choices(self, client):
        """T1-F2-02: Select multiple choices from one-or-more choice list."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "sc-8",
                    "title": "Transmission Confidentiality and Integrity",
                    "params": [
                        {
                            "id": "sc-8_prm_1",
                            "label": "Approved Encryption Protocols",
                            "select": {
                                "how-many": "one-or-more",
                                "choice": ["TLS 1.2", "TLS 1.3", "IPsec"],
                            },
                            "values": ["TLS 1.2", "TLS 1.3"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        param = client.get(f"/api/documents/catalog/{cat_id}").json()["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["TLS 1.2", "TLS 1.3"]
        assert param["select"]["how-many"] == "one-or-more"

    def test_t1_f2_03_switch_choice_selection(self, client):
        """T1-F2-03: Switch choice selection from option A to option B."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "select": {
                                "how-many": "one",
                                "choice": ["8", "12", "16"],
                            },
                            "values": ["8"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        # Switch selection from "8" to "16"
        doc["catalog"]["controls"][0]["params"][0]["values"] = ["16"]
        client.post("/api/documents/catalog", json=doc)

        param = client.get(f"/api/documents/catalog/{cat_id}").json()["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["16"]

    def test_t1_f2_04_custom_value_fallback_in_choice(self, client):
        """T1-F2-04: Custom value fallback when selecting Custom Value... in choice UI."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
                            "select": {
                                "how-many": "one",
                                "choice": ["8", "12", "16"],
                            },
                            "values": ["24"],  # Custom value outside predefined choice
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        param = client.get(f"/api/documents/catalog/{cat_id}").json()["catalog"]["controls"][0]["params"][0]
        assert param["values"] == ["24"]

    def test_t1_f2_05_add_new_choice_option(self, client):
        """T1-F2-05: Add new choice option to select.choice[] array."""
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
                                "choice": ["Weekly", "Monthly"],
                            },
                            "values": ["Weekly"],
                        }
                    ],
                }
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        # Add "Bi-weekly" to choice array
        doc["catalog"]["controls"][0]["params"][0]["select"]["choice"].append("Bi-weekly")
        client.post("/api/documents/catalog", json=doc)

        param = client.get(f"/api/documents/catalog/{cat_id}").json()["catalog"]["controls"][0]["params"][0]
        assert "Bi-weekly" in param["select"]["choice"]
        assert len(param["select"]["choice"]) == 3

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F3: Profile Stage 2 Parameter Overrides (modify['set-parameters'])
    # ─────────────────────────────────────────────────────────────────────────

    def test_t1_f3_01_override_catalog_param_value_in_profile(self, client):
        """T1-F3-01: Override catalog parameter value in Profile."""
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
            set_parameters=[{"param-id": "ac-1_prm_1", "values": ["14"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        res_prof = client.post("/api/documents/profile", json=prof_doc)
        assert res_prof.status_code == 201

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        override = saved_prof["profile"]["modify"]["set-parameters"][0]
        assert override["param-id"] == "ac-1_prm_1"
        assert override["values"] == ["14"]

    def test_t1_f3_02_override_catalog_param_label_in_profile(self, client):
        """T1-F3-02: Override catalog parameter label in Profile."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [{"id": "ia-5_prm_1", "label": "Pass Length", "values": ["8"]}],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[
                {"param-id": "ia-5_prm_1", "label": "Org Min Password Length", "values": ["14"]}
            ],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # Catalog remains unchanged
        saved_cat = client.get(f"/api/documents/catalog/{cat_id}").json()
        assert saved_cat["catalog"]["controls"][0]["params"][0]["label"] == "Pass Length"

        # Profile set-parameter has updated label
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        override = saved_prof["profile"]["modify"]["set-parameters"][0]
        assert override["label"] == "Org Min Password Length"

    def test_t1_f3_03_override_choice_selection_in_profile(self, client):
        """T1-F3-03: Override choice selection in Profile baseline."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-5_prm_1",
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
            set_parameters=[
                {
                    "param-id": "ia-5_prm_1",
                    "select": {"how-many": "one", "choice": ["14", "16"]},
                    "values": ["14"],
                }
            ],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        override = saved_prof["profile"]["modify"]["set-parameters"][0]
        assert override["select"]["choice"] == ["14", "16"]
        assert override["values"] == ["14"]

    def test_t1_f3_04_revert_profile_override_to_catalog_default(self, client):
        """T1-F3-04: Revert profile parameter override to catalog default."""
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

        # Profile with override "14"
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "ac-1_prm_1", "values": ["14"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # Revert override by removing set-parameters
        prof_doc["profile"]["modify"]["set-parameters"] = []
        client.post("/api/documents/profile", json=prof_doc)

        # Resolve parameters for profile and verify fallback to catalog value "8"
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)
        assert resolved["ac-1_prm_1"]["values"] == ["8"]

    def test_t1_f3_05_profile_override_badge_flag(self, client):
        """T1-F3-05: Display [Overridden] visual badge in Profile parameter editor (API level check)."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [{"id": "ac-2_prm_1", "values": ["30 days"]}],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[{"param-id": "ac-2_prm_1", "values": ["60 days"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        res_prof = client.get(f"/api/documents/profile/{prof_id}")
        assert res_prof.status_code == 200
        set_params = res_prof.json()["profile"]["modify"]["set-parameters"]
        # API returns set-parameters entry confirming parameter ac-2_prm_1 is overridden
        assert any(p["param-id"] == "ac-2_prm_1" for p in set_params)

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F4: Control Prose Inline Parameter Value Rendering
    # ─────────────────────────────────────────────────────────────────────────

    def test_t1_f4_01_render_prose_single_assigned_value(self):
        """T1-F4-01: Render control prose with single assigned parameter value."""
        prose = "Enforce minimum password length of {{ insert: param, ac-1_prm_1 }}."
        resolved = {"ac-1_prm_1": {"id": "ac-1_prm_1", "values": ["14"]}}
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Enforce minimum password length of 14."

    def test_t1_f4_02_render_prose_unassigned_parameter_fallback(self):
        """T1-F4-02: Render control prose with unassigned parameter (fallback placeholder)."""
        prose = "Require {{ insert: param, ac-2_prm_1 }}."
        resolved = {"ac-2_prm_1": {"id": "ac-2_prm_1", "label": "Session Timeout", "values": []}}
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Require [Session Timeout]."

    def test_t1_f4_03_render_prose_multi_value_parameter(self):
        """T1-F4-03: Render control prose with multi-value parameter."""
        prose = "Approved algorithms: {{ insert: param, sc-13_prm_1 }}."
        resolved = {"sc-13_prm_1": {"id": "sc-13_prm_1", "values": ["AES-256", "SHA-384"]}}
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Approved algorithms: AES-256, SHA-384."

    def test_t1_f4_04_render_prose_post_profile_resolution_override(self):
        """T1-F4-04: Render control prose post profile resolution override."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": ["8"]}],
                }
            ]
        )
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_doc["catalog"]["uuid"],
            set_parameters=[{"param-id": "ac-1_prm_1", "values": ["14"]}],
        )

        resolved = resolve_parameters(cat_doc, prof_doc)
        prose = "Minimum length: {{ insert: param, ac-1_prm_1 }}."
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Minimum length: 14."

    def test_t1_f4_05_render_multiple_distinct_inserts(self):
        """T1-F4-05: Render multiple distinct parameter inserts in single control statement."""
        prose = "Change {{ insert: param, p1 }} every {{ insert: param, p2 }} days."
        resolved = {
            "p1": {"id": "p1", "values": ["password"]},
            "p2": {"id": "p2", "values": ["90"]},
        }
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Change password every 90 days."

    # ─────────────────────────────────────────────────────────────────────────
    # Feature F5: OSCAL Schema Validation, Versioning & Serialization
    # ─────────────────────────────────────────────────────────────────────────

    def test_t1_f5_01_export_catalog_with_parameters(self, client):
        """T1-F5-01: Export Catalog with parameters to compliant OSCAL JSON."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": f"ctrl-{i}",
                    "title": f"Control {i}",
                    "params": [{"id": f"param-{i}", "values": [f"val-{i}"]}],
                }
                for i in range(1, 6)
            ]
        )
        cat_id = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        res_export = client.get(f"/api/export/catalog/{cat_id}?format=json")
        assert res_export.status_code == 200
        exported_json = res_export.json()
        # Schema validation clean pass
        validate_document("catalogs", exported_json)

    def test_t1_f5_02_export_profile_with_set_parameters(self, client):
        """T1-F5-02: Export Profile with set-parameters overrides to OSCAL JSON."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ac-1", "params": [{"id": "ac-1_prm_1", "values": ["8"]}]}]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[
                {"param-id": "ac-1_prm_1", "values": ["14"]},
                {"param-id": "ac-1_prm_2", "values": ["annually"]},
                {"param-id": "ac-1_prm_3", "values": ["written"]},
            ],
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        res_export = client.get(f"/api/export/profile/{prof_id}?format=json")
        assert res_export.status_code == 200
        exported_json = res_export.json()
        assert len(exported_json["profile"]["modify"]["set-parameters"]) == 3
        # Preprocess and validate against schema
        from app.storage import preprocess_profile_for_saving
        val_doc = preprocess_profile_for_saving(exported_json, persist_local_catalog=False)
        validate_document("profiles", val_doc)

    def test_t1_f5_03_purge_empty_values_array_on_serialization(self, client):
        """T1-F5-03: Purge empty values array during serialization."""
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {
                            "id": "ac-1_prm_1",
                            "label": "unassigned param",
                            "values": [],  # Empty list
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
        # values key purged due to minItems: 1 constraint
        assert "values" not in param

    def test_t1_f5_04_purge_empty_set_parameters_array(self, client):
        """T1-F5-04: Purge empty set-parameters array when all overrides are reverted."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ac-1", "params": [{"id": "ac-1_prm_1", "values": ["8"]}]}]
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=[],  # Empty overrides
        )
        prof_id = prof_doc["profile"]["uuid"]
        res = client.post("/api/documents/profile", json=prof_doc)
        assert res.status_code == 201

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        modify = saved_prof["profile"].get("modify", {})
        # set-parameters key purged cleanly
        assert "set-parameters" not in modify

    def test_t1_f5_05_import_oscal_catalog_json(self, client):
        """T1-F5-05: Import OSCAL Catalog JSON and extract parameters."""
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "imported_prm_1", "values": ["imported value"]}],
                }
            ]
        )
        cat_id = cat_doc["catalog"]["uuid"]

        # Save catalog via API (simulating JSON import endpoint / storage insertion)
        res_import = client.post("/api/documents/catalog", json=cat_doc)
        assert res_import.status_code == 201

        # Extract and verify parameters
        res_get = client.get(f"/api/documents/catalog/{cat_id}")
        assert res_get.status_code == 200
        extracted_params = res_get.json()["catalog"]["controls"][0]["params"]
        assert len(extracted_params) == 1
        assert extracted_params[0]["id"] == "imported_prm_1"
        assert extracted_params[0]["values"] == ["imported value"]
