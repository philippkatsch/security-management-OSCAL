"""
Empirical stress test suite for Parameter Value Assignment and Profile Resolution.
Created by challenger_1 to stress-test edge cases and corner cases.
"""

import pytest
import copy
from app.validation import validate_document, OSCALValidationError
from app.storage import remove_empty_arrays, preprocess_profile_for_saving
from tests.factories import CatalogFactory, ProfileFactory


class TestEmpiricalStressScenarios:

    # =========================================================================
    # SCENARIO 1: Parameter Value Assignment Edge Cases
    # =========================================================================

    def test_s1_01_special_characters_in_parameter_values(self, client, isolated_data_dir):
        r"""Test parameter value assignment with special characters, unicode, emojis, HTML, quotes, backslashes.
        Note: Multiline strings with '\n' or leading/trailing whitespace fail OSCAL schema regex '^\S(.*?\S)?$'
        which is an intended schema constraint.
        """
        cat_doc = CatalogFactory.build(title="Special Chars Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        special_vals = [
            "🔒 Passphrase @#$%^&*()_+ space <> \"quote\" 'single' \\backslash /slash",
            "<script>alert('xss')</script>",
            "Überschreibung & Umläute 🔥 日本語 🚀"
        ]

        set_params = [
            {
                "param-id": "ac-1_prm_1",
                "values": special_vals,
                "label": "Special Char Label: <&'\"🚀>"
            }
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile Special Chars"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201, f"Failed to save profile: {res_save.text}"

        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_params = res_get.json()["profile"]["modify"]["set-parameters"]
        assert get_params[0]["values"] == special_vals
        assert get_params[0]["label"] == "Special Char Label: <&'\"🚀>"

        # Empirical test: Verify that multiline strings containing newlines ARE rejected by OSCAL schema
        multiline_prof = copy.deepcopy(prof_doc)
        multiline_prof["profile"]["modify"]["set-parameters"][0]["values"] = ["Line1\nLine2"]
        res_multiline = client.post("/api/documents/profiles", json=multiline_prof)
        assert res_multiline.status_code == 400
        assert "does not match" in res_multiline.text

    def test_s1_02_empty_and_whitespace_values_in_parameters(self, client, isolated_data_dir):
        """Test how empty string values and empty lists behave in remove_empty_arrays and document validation."""
        cat_doc = CatalogFactory.build(title="Empty Values Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # set-parameter with empty list and whitespace-only string
        raw_set_params = [
            {
                "param-id": "ac-1_prm_1",
                "values": ["   ", ""],
                "label": "  "
            }
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=raw_set_params,
            title="Profile Empty Values"
        )

        cleaned_doc = remove_empty_arrays(prof_doc)
        # Verify that whitespace-only string and empty list are purged from values
        set_p = cleaned_doc.get("profile", {}).get("modify", {}).get("set-parameters", [])
        assert len(set_p) == 1
        assert "values" not in set_p[0], "Empty/whitespace values array should be purged cleanly"

        # Check schema validation passes for set-parameter without values
        validate_document("profiles", cleaned_doc)

    def test_s1_03_multi_choice_selections(self, client, isolated_data_dir):
        """Test multi-choice parameter selection structures."""
        cat_doc = CatalogFactory.build(title="Multi Choice Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        set_params = [
            {
                "param-id": "ac-2_prm_3",
                "values": ["mfa_token", "biometric_scan"],
                "select": {
                    "how-many": "one-or-more",
                    "choice": ["mfa_token", "biometric_scan", "sms_otp", "hardware_key"]
                }
            }
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile Multi-Choice"
        )

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        prof_uuid = prof_doc["profile"]["uuid"]
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        stored_p = res_get.json()["profile"]["modify"]["set-parameters"][0]
        assert stored_p["select"]["how-many"] == "one-or-more"
        assert stored_p["values"] == ["mfa_token", "biometric_scan"]

    def test_s1_04_constraint_expressions_and_validation(self, client, isolated_data_dir):
        """Test constraint expressions and schema validation behavior."""
        cat_doc = CatalogFactory.build(title="Constraint Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Valid constraint structure
        set_params = [
            {
                "param-id": "ac-1_prm_1",
                "values": ["30 minutes"],
                "constraints": [
                    {
                        "description": "Must match regex limit",
                        "tests": [
                            {
                                "expression": "^[0-9]+ (minutes|hours)$",
                                "remarks": "Format test"
                            }
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile Constraint Test"
        )
        validate_document("profiles", prof_doc)

        # Empirical test: description:"" is purged by remove_empty_arrays, resulting in valid schema
        bad_prof = copy.deepcopy(prof_doc)
        bad_prof["profile"]["modify"]["set-parameters"][0]["constraints"][0]["description"] = ""
        cleaned = remove_empty_arrays(bad_prof)
        assert "description" not in cleaned["profile"]["modify"]["set-parameters"][0]["constraints"][0]
        validate_document("profiles", cleaned)

    # =========================================================================
    # SCENARIO 2: Profile Overrides at Catalog, Group, and Control Levels
    # =========================================================================

    def test_s2_01_override_params_at_catalog_group_control_levels(self, client, isolated_data_dir):
        """Test profile set-parameters overrides for catalog-level, group-level, and control-level parameters."""
        cat_doc = {
            "catalog": {
                "uuid": "10000000-0000-0000-0000-000000000001",
                "metadata": {
                    "title": "Multi-Level Param Base Catalog",
                    "last-modified": "2026-01-01T00:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "params": [
                    {"id": "cat_prm_1", "label": "Global Param", "values": ["global_default"]}
                ],
                "groups": [
                    {
                        "id": "ac-group",
                        "title": "Access Control Group",
                        "params": [
                            {"id": "grp_prm_1", "label": "Group Param", "values": ["group_default"]}
                        ],
                        "controls": [
                            {
                                "id": "ac-1",
                                "title": "Access Control Policy",
                                "params": [
                                    {"id": "ctrl_prm_1", "label": "Control Param", "values": ["ctrl_default"]}
                                ],
                                "controls": [
                                    {
                                        "id": "ac-1.1",
                                        "title": "Sub Control",
                                        "params": [
                                            {"id": "sub_prm_1", "label": "Sub Control Param", "values": ["sub_default"]}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        set_params = [
            {"param-id": "cat_prm_1", "values": ["global_override"]},
            {"param-id": "grp_prm_1", "values": ["group_override"]},
            {"param-id": "ctrl_prm_1", "values": ["ctrl_override"]},
            {"param-id": "sub_prm_1", "values": ["sub_override"]}
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid="10000000-0000-0000-0000-000000000001",
            set_parameters=set_params,
            title="Multi-Level Overrides Profile"
        )
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201

        prof_uuid = prof_doc["profile"]["uuid"]
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        stored_sp = res_get.json()["profile"]["modify"]["set-parameters"]
        assert len(stored_sp) == 4

    def test_s2_02_duplicate_param_ids_in_set_parameters(self, client, isolated_data_dir):
        """Test behavior when duplicate param-ids are defined in profile set-parameters."""
        cat_doc = CatalogFactory.build(title="Dup Param Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        set_params = [
            {"param-id": "ac-1_prm_1", "values": ["first_val"]},
            {"param-id": "ac-1_prm_1", "values": ["second_val_wins"]}
        ]

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Duplicate Param-Id Profile"
        )
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res_get = client.get(f"/api/documents/profiles/{prof_doc['profile']['uuid']}")
        stored = res_get.json()["profile"]["modify"]["set-parameters"]
        assert len(stored) == 2
        assert stored[1]["values"] == ["second_val_wins"]

    # =========================================================================
    # SCENARIO 3: Resolving Profiles with Conflicting or Nested Overrides
    # =========================================================================

    def test_s3_01_nested_profile_imports_parameter_precedence(self, client, isolated_data_dir):
        """Test multi-level profile inheritance chain (Profile C -> Profile B -> Profile A -> Base Catalog)."""
        cat_doc = CatalogFactory.build(title="Inheritance Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile A overrides param ac-1_prm_1 to "Level A"
        prof_a = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=[{"param-id": "ac-1_prm_1", "values": ["Level A"]}],
            title="Profile A"
        )
        prof_a_uuid = prof_a["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_a)

        # Profile B imports Profile A and overrides ac-1_prm_1 to "Level B"
        prof_b = {
            "profile": {
                "uuid": "20000000-0000-0000-0000-000000000002",
                "metadata": {
                    "title": "Profile B",
                    "last-modified": "2026-01-01T00:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [
                    {"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}
                ],
                "modify": {
                    "set-parameters": [
                        {"param-id": "ac-1_prm_1", "values": ["Level B"]}
                    ]
                }
            }
        }
        client.post("/api/documents/profiles", json=prof_b)

        # Profile C imports Profile B and overrides ac-1_prm_1 to "Level C"
        prof_c = {
            "profile": {
                "uuid": "20000000-0000-0000-0000-000000000003",
                "metadata": {
                    "title": "Profile C",
                    "last-modified": "2026-01-01T00:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [
                    {"href": f"../profiles/20000000-0000-0000-0000-000000000002.json", "include-all": {}}
                ],
                "modify": {
                    "set-parameters": [
                        {"param-id": "ac-1_prm_1", "values": ["Level C"]}
                    ]
                }
            }
        }
        res_c = client.post("/api/documents/profiles", json=prof_c)
        assert res_c.status_code == 201

    def test_s3_02_partial_parameter_field_overrides(self, client, isolated_data_dir):
        """Test partial override where one profile overrides label and another overrides values."""
        cat_doc = CatalogFactory.build(title="Partial Override Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=[
                {"param-id": "ac-1_prm_1", "label": "Custom Label Only"}
            ],
            title="Partial Override Label Profile"
        )
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

    # =========================================================================
    # SCENARIO 4: Schema Validation after Purging Empty Arrays
    # =========================================================================

    def test_s4_01_purge_empty_set_parameters_and_modify_validation(self, client, isolated_data_dir):
        """Test schema validation when set-parameters is empty and purged by remove_empty_arrays."""
        cat_doc = CatalogFactory.build(title="Purge Empty Test Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Empty Modify Profile")
        prof_doc["profile"]["modify"] = {
            "set-parameters": [],
            "alters": []
        }

        cleaned = preprocess_profile_for_saving(prof_doc, persist_local_catalog=False)
        # Confirm set-parameters and alters are purged
        assert "set-parameters" not in cleaned.get("profile", {}).get("modify", {})
        assert "alters" not in cleaned.get("profile", {}).get("modify", {})
        assert "modify" not in cleaned["profile"] or cleaned["profile"]["modify"] == {}

        # Validate schema passes
        validate_document("profiles", cleaned)

    def test_s4_02_purge_empty_arrays_in_catalog(self, client, isolated_data_dir):
        """Test remove_empty_arrays purging empty controls/groups/params/props/links in catalog."""
        cat_doc = {
            "catalog": {
                "uuid": "30000000-0000-0000-0000-000000000001",
                "metadata": {
                    "title": "Empty Arrays Catalog",
                    "last-modified": "2026-01-01T00:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                    "props": [],
                    "links": []
                },
                "params": [],
                "controls": [],
                "groups": []
            }
        }

        cleaned = remove_empty_arrays(cat_doc)
        assert "props" not in cleaned["catalog"]["metadata"]
        assert "links" not in cleaned["catalog"]["metadata"]
        assert "params" not in cleaned["catalog"]
        assert "controls" not in cleaned["catalog"]
        assert "groups" not in cleaned["catalog"]

        validate_document("catalogs", cleaned)

