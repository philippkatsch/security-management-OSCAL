"""
Integration tests for Profile alterations and properties modifications (US 2.4, 2.11).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileAlters:
    """Tests for Profile control alterations (adds/removes) and property modifications."""

    def test_profile_alters_adds_parts_and_props(self, client, isolated_data_dir):
        # Create and save base catalog with controls ac-1 and ac-2
        cat_doc = CatalogFactory.with_controls(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)


        # Define alters: adds statement part and adds a property
        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "starting",
                        "parts": [
                            {
                                "id": "ac-1_org_smt",
                                "name": "statement",
                                "prose": "Organization-specific requirement."
                            }
                        ]
                    },
                    {
                        "position": "ending",
                        "props": [
                            {
                                "name": "custom-prop",
                                "value": "custom-value"
                            }
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(
            catalog_uuid=cat_uuid,
            alters=alters,
            title="Profile with Adds Alterations"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve profile and verify additions
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()

        stored_alters = get_data["profile"]["modify"]["alters"]
        assert len(stored_alters) == 1
        assert stored_alters[0]["control-id"] == "ac-1"
        assert len(stored_alters[0]["adds"]) == 2

        # Verify added part
        add_part = stored_alters[0]["adds"][0]
        assert add_part["position"] == "starting"
        assert add_part["parts"][0]["id"] == "ac-1_org_smt"
        assert add_part["parts"][0]["prose"] == "Organization-specific requirement."

        # Verify added prop
        add_prop = stored_alters[0]["adds"][1]
        assert add_prop["position"] == "ending"
        assert add_prop["props"][0]["name"] == "custom-prop"
        assert add_prop["props"][0]["value"] == "custom-value"

    def test_profile_alters_removes(self, client, isolated_data_dir):
        # Create and save base catalog with controls ac-1 and ac-2
        cat_doc = CatalogFactory.with_controls(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)


        # Define alters: removes a statement part
        alters = [
            {
                "control-id": "ac-2",
                "removes": [
                    {
                        "by-id": "ac-2_smt.a",
                        "by-name": "statement",
                        "by-class": "class-x",
                        "by-item-name": "part"
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(
            catalog_uuid=cat_uuid,
            alters=alters,
            title="Profile with Removes Alterations"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve and verify removals
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()

        stored_alters = get_data["profile"]["modify"]["alters"]
        assert len(stored_alters) == 1
        assert stored_alters[0]["control-id"] == "ac-2"
        assert len(stored_alters[0]["removes"]) == 1
        assert stored_alters[0]["removes"][0]["by-id"] == "ac-2_smt.a"

    def test_prune_orphaned_alters_for_unimported_controls(self, client, isolated_data_dir):
        # Create base catalog with controls ac-1, ac-2
        cat_doc = CatalogFactory.with_controls(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile with alters for valid control ac-1 and orphaned control GV.OC
        alters = [
            {"control-id": "ac-1", "adds": [{"position": "starting", "props": [{"name": "p1", "value": "v1"}]}]},
            {"control-id": "GV.OC", "removes": [{"by-id": "GV.OC_smt"}]}
        ]

        prof_doc = ProfileFactory.with_alters(
            catalog_uuid=cat_uuid,
            alters=alters,
            title="Profile with Orphaned Alters"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()

        # Verify that orphaned alter for GV.OC was automatically pruned while ac-1 remains
        stored_alters = get_data["profile"]["modify"]["alters"]
        assert len(stored_alters) == 1
        assert stored_alters[0]["control-id"] == "ac-1"

