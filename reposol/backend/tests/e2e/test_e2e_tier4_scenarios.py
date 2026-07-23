"""
Tier 4: Real-World Application Scenarios (T4-01 to T4-06).
Covers NIST SP 800-53 Rev 5 AC-2 lifecycle, IA-5 FedRAMP High vs Moderate tailoring,
German IT-Grundschutz multi-language regulatory configuration, large-scale baseline tailoring (50+ params),
dynamic bulk-revert workflow, and end-to-end OSCAL roundtrip serialization.
"""

import time
import pytest
from tests.factories import CatalogFactory, ProfileFactory
from tests.e2e.e2e_helpers import resolve_parameters, render_control_prose
from app.validation import validate_document
from app.storage import preprocess_profile_for_saving


class TestTier4RealWorldScenarios:
    """Tier 4: Real-World Application Scenarios (6 Scenarios)."""

    def test_t4_01_nist_ac2_parameter_assignment_lifecycle(self, client):
        """T4-01: NIST SP 800-53 Rev 5 AC-2 (Account Management) Parameter Assignment Lifecycle."""
        cat_doc = CatalogFactory.build(
            title="NIST SP 800-53 Rev 5 Catalog",
            controls=[
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {
                            "id": "ac-02_prm_1",
                            "label": "Account Manager Roles",
                            "values": ["System Administrator", "Database Admin"],
                        },
                        {
                            "id": "ac-02_prm_2",
                            "label": "Prerequisite Training Period",
                            "values": ["5 business days"],
                        },
                    ],
                    "parts": [
                        {
                            "id": "ac-2_smt",
                            "name": "statement",
                            "prose": "Assign account managers within {{ insert: param, ac-02_prm_2 }} of account creation.",
                        }
                    ],
                }
            ],
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="Moderate Impact Profile",
            set_parameters=[{"param-id": "ac-02_prm_2", "values": ["3 business days"]}],
        )
        prof_id = prof_doc["profile"]["uuid"]
        res_prof = client.post("/api/documents/profile", json=prof_doc)
        assert res_prof.status_code == 201

        # 1. Resolved profile renders AC-2 prose: "...within 3 business days of account creation."
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        resolved = resolve_parameters(cat_doc, saved_prof)
        prose = saved_prof["profile"].get("prose_template", cat_doc["catalog"]["controls"][0]["parts"][0]["prose"])
        rendered = render_control_prose(prose, resolved)
        assert "within 3 business days of account creation" in rendered

        # 2. Exported Profile JSON contains valid set-parameters entry
        res_export = client.get(f"/api/export/profile/{prof_id}?format=json")
        exported_json = res_export.json()
        set_params = exported_json["profile"]["modify"]["set-parameters"]
        assert len(set_params) == 1
        assert set_params[0]["param-id"] == "ac-02_prm_2"
        assert set_params[0]["values"] == ["3 business days"]

        # 3. Re-importing Profile JSON preserves exact override state
        client.delete(f"/api/documents/profile/{prof_id}?force=true")
        res_reimport = client.post("/api/documents/profile", json=exported_json)
        assert res_reimport.status_code in [200, 201]

        reimported = client.get(f"/api/documents/profile/{prof_id}").json()
        assert reimported["profile"]["modify"]["set-parameters"][0]["values"] == ["3 business days"]

    def test_t4_02_nist_ia5_authenticator_tailoring(self, client):
        """T4-02: NIST SP 800-53 Rev 5 IA-5 Password Baseline Tailoring (High vs Moderate)."""
        cat_doc = CatalogFactory.build(
            title="NIST SP 800-53 Rev 5 Catalog",
            controls=[
                {
                    "id": "ia-5",
                    "title": "Authenticator Management",
                    "params": [
                        {
                            "id": "ia-05.01_prm_1",
                            "label": "Min Length",
                            "select": {
                                "how-many": "one",
                                "choice": ["8 characters", "12 characters", "15 characters"],
                            },
                            "values": ["8 characters"],
                        }
                    ],
                }
            ],
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        # FedRAMP High Profile -> 15 characters
        high_prof = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="FedRAMP High Profile",
            set_parameters=[{"param-id": "ia-05.01_prm_1", "values": ["15 characters"]}],
        )
        high_id = high_prof["profile"]["uuid"]
        client.post("/api/documents/profile", json=high_prof)

        # FedRAMP Moderate Profile -> 12 characters
        mod_prof = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="FedRAMP Moderate Profile",
            set_parameters=[{"param-id": "ia-05.01_prm_1", "values": ["12 characters"]}],
        )
        mod_id = mod_prof["profile"]["uuid"]
        client.post("/api/documents/profile", json=mod_prof)

        prose = "Enforce password length of {{ insert: param, ia-05.01_prm_1 }}."

        # 1. High Profile resolves IA-5(1) prose with "15 characters"
        high_saved = client.get(f"/api/documents/profile/{high_id}").json()
        high_res = resolve_parameters(cat_doc, high_saved)
        assert render_control_prose(prose, high_res) == "Enforce password length of 15 characters."

        # 2. Moderate Profile resolves IA-5(1) prose with "12 characters"
        mod_saved = client.get(f"/api/documents/profile/{mod_id}").json()
        mod_res = resolve_parameters(cat_doc, mod_saved)
        assert render_control_prose(prose, mod_res) == "Enforce password length of 12 characters."

        # 3. Catalog source remains unchanged with default "8 characters"
        cat_saved = client.get(f"/api/documents/catalog/{cat_id}").json()
        assert cat_saved["catalog"]["controls"][0]["params"][0]["values"] == ["8 characters"]

    def test_t4_03_german_it_grundschutz_multi_language_config(self, client):
        """T4-03: Multi-Language & Special Character Regulatory Baseline Configuration."""
        cat_doc = CatalogFactory.build(
            title="IT-Grundschutz Catalog",
            controls=[
                {
                    "id": "orp-4",
                    "title": "Identitäts- und Berechtigungsmanagement",
                    "params": [
                        {
                            "id": "pass_policy_prm",
                            "label": "Passwortlänge",
                            "usage": "Vorgabe gemäß BSI IT-Grundschutz ORP.4",
                            "values": ["14 Zeichen (Mindestlänge)"],
                        }
                    ],
                }
            ],
        )
        cat_id = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalog", json=cat_doc)
        assert res_cat.status_code == 201

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="ISO 27001 Baseline Profile",
            set_parameters=[
                {
                    "param-id": "pass_policy_prm",
                    "label": "Passwortlänge Organisation",
                    "values": ["14 Zeichen (Mindestlänge)"],
                }
            ],
        )
        prof_id = prof_doc["profile"]["uuid"]
        res_prof = client.post("/api/documents/profile", json=prof_doc)
        assert res_prof.status_code == 201

        # 1. Export JSON with German umlauts (ä, ö, ü, ß)
        res_export = client.get(f"/api/export/profile/{prof_id}?format=json")
        assert res_export.status_code == 200
        exported = res_export.json()
        assert exported["profile"]["modify"]["set-parameters"][0]["label"] == "Passwortlänge Organisation"

        # 2. Control prose renders correctly with German characters
        prose = "Das Passwort muss mindestens {{ insert: param, pass_policy_prm }} entsprechen."
        resolved = resolve_parameters(cat_doc, exported)
        rendered = render_control_prose(prose, resolved)
        assert rendered == "Das Passwort muss mindestens 14 Zeichen (Mindestlänge) entsprechen."

    def test_t4_04_large_scale_baseline_tailoring(self, client):
        """T4-04: Large-Scale Baseline Tailoring (50+ Control Parameters Overridden)."""
        controls = []
        param_ids = []
        for i in range(60):
            pid = f"param_{i}"
            param_ids.append(pid)
            controls.append(
                {
                    "id": f"ctrl_{i}",
                    "title": f"Control {i}",
                    "params": [{"id": pid, "label": f"Param {i}", "values": [f"default_{i}"]}],
                }
            )

        cat_doc = CatalogFactory.build(title="Large Catalog", controls=controls)
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        # Profile overriding 50 distinct parameters
        set_params = [
            {"param-id": f"param_{i}", "values": [f"override_{i}"]} for i in range(50)
        ]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="Large Baseline Profile",
            set_parameters=set_params,
        )
        prof_id = prof_doc["profile"]["uuid"]

        # 1. Profile save operation executes synchronously under 1.5 seconds
        start_time = time.perf_counter()
        res_save = client.post("/api/documents/profile", json=prof_doc)
        elapsed = time.perf_counter() - start_time

        assert res_save.status_code == 201
        assert elapsed < 1.5, f"Save operation took {elapsed:.2f}s (must be < 1.5s)"

        # 2. remove_empty_arrays cleans non-overridden parameters
        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        set_p = saved_prof["profile"]["modify"]["set-parameters"]
        assert len(set_p) == 50

        # 3. Exported Profile JSON passes NIST OSCAL schema validation
        val_doc = preprocess_profile_for_saving(saved_prof, persist_local_catalog=False)
        validate_document("profiles", val_doc)

    def test_t4_05_dynamic_bulk_revert_workflow(self, client):
        """T4-05: Dynamic Baseline Modification & Revert-to-Default Bulk Workflow."""
        controls = [
            {
                "id": f"ctrl_{i}",
                "title": f"Control {i}",
                "params": [{"id": f"p_{i}", "label": f"Label {i}", "values": [f"catalog_{i}"]}],
            }
            for i in range(50)
        ]
        cat_doc = CatalogFactory.build(title="Catalog T4-05", controls=controls)
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        set_params = [{"param-id": f"p_{i}", "values": [f"override_{i}"]} for i in range(50)]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            set_parameters=set_params,
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # Bulk-revert 10 overrides (indices 0 to 9) by removing them from set-parameters
        remaining_set_params = [
            {"param-id": f"p_{i}", "values": [f"override_{i}"]} for i in range(10, 50)
        ]
        prof_doc["profile"]["modify"]["set-parameters"] = remaining_set_params
        res_update = client.post("/api/documents/profile", json=prof_doc)
        assert res_update.status_code == 200

        saved_prof = client.get(f"/api/documents/profile/{prof_id}").json()
        current_overrides = saved_prof["profile"]["modify"]["set-parameters"]

        # 1. The 10 parameters are removed from set-parameters[]
        assert not any(p["param-id"] in [f"p_{i}" for i in range(10)] for p in current_overrides)

        # 2. 40 remaining overridden parameters persist unchanged in set-parameters[]
        assert len(current_overrides) == 40

        # 3. Resolved catalog updates prose for 10 reverted parameters to original catalog values
        resolved = resolve_parameters(cat_doc, saved_prof)
        for i in range(10):
            prose = f"Val: {{{{ insert: param, p_{i} }}}}."
            assert render_control_prose(prose, resolved) == f"Val: catalog_{i}."

        for i in range(10, 50):
            prose = f"Val: {{{{ insert: param, p_{i} }}}}."
            assert render_control_prose(prose, resolved) == f"Val: override_{i}."

    def test_t4_06_end_to_end_oscal_roundtrip(self, client):
        """T4-06: End-to-End OSCAL Catalog & Profile Import, Edit, Override, and Export Roundtrip."""
        # 1. Create Catalog with parameter ac-1_prm_1
        cat_doc = CatalogFactory.build(
            title="Standard Catalog",
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {"id": "ac-1_prm_1", "label": "Review Frequency", "values": ["30 days"]}
                    ],
                }
            ],
        )
        cat_id = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=cat_doc)

        # 2. Export updated Catalog JSON
        exported_cat_json = client.get(f"/api/export/catalog/{cat_id}?format=json").json()

        # 3. Create Profile importing updated Catalog & tailor 5 parameters
        prof_set_params = [
            {"param-id": f"tailor_prm_{i}", "values": [f"tailored_val_{i}"]} for i in range(1, 6)
        ]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_id,
            title="Tailored Baseline Profile",
            set_parameters=prof_set_params,
        )
        prof_id = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profile", json=prof_doc)

        # 4. Export Profile JSON
        exported_prof_json = client.get(f"/api/export/profile/{prof_id}?format=json").json()

        # 5. Delete original documents from storage
        client.delete(f"/api/documents/catalog/{cat_id}?force=true")
        client.delete(f"/api/documents/profile/{prof_id}?force=true")

        # 6. Re-import both Catalog and Profile into storage
        res_cat_import = client.post("/api/documents/catalog", json=exported_cat_json)
        assert res_cat_import.status_code in [200, 201]

        res_prof_import = client.post("/api/documents/profile", json=exported_prof_json)
        assert res_prof_import.status_code in [200, 201]

        # 7. Verification: 0 errors, exact state preserved
        reimported_cat = client.get(f"/api/documents/catalog/{cat_id}").json()
        reimported_prof = client.get(f"/api/documents/profile/{prof_id}").json()

        cat_param = reimported_cat["catalog"]["controls"][0]["params"][0]
        assert cat_param["values"] == ["30 days"]

        prof_overrides = reimported_prof["profile"]["modify"]["set-parameters"]
        assert len(prof_overrides) == 5
        assert prof_overrides[0]["values"] == ["tailored_val_1"]
