"""
Integration tests for Profile parameter overrides (US 2.3, 2.8, 2.17).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileParams:
    """Tests for Profile parameter overrides, including multi-value parameters and constraints."""

    def test_set_parameter_overrides(self, client, isolated_data_dir):
        # Create and save base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create a profile with simple parameter overrides
        set_params = [
            {
                "param-id": "ac-1_prm_1",
                "values": ["annually"]
            }
        ]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile with Parameters"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201
        
        # Get profile and verify parameters are stored
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        stored_params = get_data["profile"]["modify"]["set-parameters"]
        assert len(stored_params) == 1
        assert stored_params[0]["param-id"] == "ac-1_prm_1"
        assert stored_params[0]["values"] == ["annually"]

    def test_multi_value_select_parameter_setting(self, client, isolated_data_dir):
        # Create and save base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create a profile with multi-value select parameters (US 2.17)
        set_params = [
            {
                "param-id": "ac-2_prm_3",
                "values": ["token", "biometric"],
                "select": {
                    "how-many": "one-or-more",
                    "choice": ["token", "biometric", "sms", "email"]
                }
            }
        ]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile with Multi-Value Select"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Get profile and verify
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        stored_params = get_data["profile"]["modify"]["set-parameters"]
        assert len(stored_params) == 1
        assert stored_params[0]["param-id"] == "ac-2_prm_3"
        assert stored_params[0]["values"] == ["token", "biometric"]
        assert stored_params[0]["select"]["how-many"] == "one-or-more"
        assert stored_params[0]["select"]["choice"] == ["token", "biometric", "sms", "email"]

    def test_parameter_constraints_schema_validation(self, client, isolated_data_dir):
        # Create and save base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create a profile with parameter containing constraints (US 2.8)
        set_params = [
            {
                "param-id": "ac-2_prm_1",
                "values": ["90 days"],
                "constraints": [
                    {
                        "description": "Must be in format: number + unit",
                        "tests": [
                            {
                                "expression": "^[0-9]+ (days|months)$",
                                "remarks": "Format validation test"
                            }
                        ]
                    }
                ]
            }
        ]
        prof_doc = ProfileFactory.with_set_parameters(
            catalog_uuid=cat_uuid,
            set_parameters=set_params,
            title="Profile with Parameter Constraints"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Get profile and verify constraints are preserved
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        stored_params = get_data["profile"]["modify"]["set-parameters"]
        assert len(stored_params) == 1
        assert "constraints" in stored_params[0]
        assert stored_params[0]["constraints"][0]["tests"][0]["expression"] == "^[0-9]+ (days|months)$"
