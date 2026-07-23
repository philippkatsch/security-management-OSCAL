"""
Integration tests for Profile merge configurations and custom groupings (US 2.7, 2.12).
"""
import os
import json
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileMerge:
    """Tests for Profile merge directives, flat vs hierarchical structures, and custom groupings."""

    def test_merge_as_is(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.with_merge(catalog_uuid=cat_uuid, merge_type="as-is")
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        merge = res_get.json()["profile"]["merge"]
        assert merge.get("as-is") is True
        assert "flat" not in merge
        assert "custom" not in merge

    def test_merge_flat(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.with_merge(catalog_uuid=cat_uuid, merge_type="flat")
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        merge = res_get.json()["profile"]["merge"]
        assert "flat" in merge
        assert "as-is" not in merge
        assert "custom" not in merge

    def test_merge_custom_groups(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        custom_groups = [
            {
                "id": "grp-1",
                "title": "Custom Merged Group 1"
            }
        ]

        prof_doc = ProfileFactory.with_merge(
            catalog_uuid=cat_uuid,
            merge_type="custom",
            custom_groups=custom_groups
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        merge = res_get.json()["profile"]["merge"]
        assert "custom" in merge
        assert merge["custom"]["groups"] == custom_groups
        assert "as-is" not in merge
        assert "flat" not in merge

    def test_default_structure_preprocessing_and_postprocessing(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Build a profile with custom merge and a defaultStructure attribute
        prof_doc = ProfileFactory.build(
            title="Default Structure Profile",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={
                "custom": {
                    "defaultStructure": "hierarchical",
                    "groups": [
                        {"id": "grp-1", "title": "Group 1"}
                    ]
                }
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Check raw file on disk: defaultStructure should be stripped from merge.custom
        # and written to metadata.props as default-structure
        profile_path = os.path.join(isolated_data_dir, "profiles", f"{prof_uuid}.json")
        assert os.path.exists(profile_path)
        with open(profile_path, "r", encoding="utf-8") as f:
            raw_prof = json.load(f)
        
        profile_data = raw_prof["profile"]
        assert "defaultStructure" not in profile_data.get("merge", {}).get("custom", {})
        
        props = profile_data.get("metadata", {}).get("props", [])
        default_struct_prop = [p for p in props if p["name"] == "default-structure"]
        assert len(default_struct_prop) == 1
        assert default_struct_prop[0]["value"] == "hierarchical"

        # Check via API (GET): defaultStructure should be reconstructed
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        assert get_data["profile"]["merge"]["custom"]["defaultStructure"] == "hierarchical"
