"""
Integration tests for Profile local controls (US 2.5).
"""
import os
import json
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileLocalControls:
    """Tests for Profile user-defined local controls, including storage preprocessing/postprocessing and cleanup."""

    def test_local_controls_lifecycle(self, client, isolated_data_dir):
        # 1. Create a catalog first
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Create profile with local-controls
        local_controls = [
            {
                "id": "corp-sec-1",
                "title": "Corporate Security Training",
                "parts": [
                    {
                        "id": "corp-sec-1_smt",
                        "name": "statement",
                        "prose": "All employees must complete security training."
                    }
                ]
            }
        ]
        
        prof_doc = ProfileFactory.with_local_controls(
            catalog_uuid=cat_uuid,
            local_controls=local_controls,
            title="Profile with Local Controls"
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        
        # Save profile - should succeed
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # 3. Retrieve profile and check that it contains the local-controls
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        assert "local-controls" in get_data["profile"]
        assert len(get_data["profile"]["local-controls"]) == 1
        assert get_data["profile"]["local-controls"][0]["id"] == "corp-sec-1"

        # 4. Check the filesystem directly to verify preprocessing
        # The stored profile JSON should NOT contain "local-controls"
        profile_path = os.path.join(isolated_data_dir, "profiles", f"{prof_uuid}.json")
        assert os.path.exists(profile_path)
        with open(profile_path, "r", encoding="utf-8") as f:
            stored_prof = json.load(f)
        assert "local-controls" not in stored_prof["profile"]
        
        # Find the imported local-controls catalog UUID from the imports list
        imports = stored_prof["profile"].get("imports", [])
        # We find the import that is not pointing to the base catalog
        local_import = [imp for imp in imports if cat_uuid not in imp["href"]]
        assert len(local_import) == 1
        
        # Retrieve the local catalog UUID from its href, e.g. ../catalogs/{uuid}.json
        import re
        href = local_import[0]["href"]
        uuid_match = re.search(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})", href)
        assert uuid_match is not None
        local_catalog_uuid = uuid_match.group(1)

        # The local catalog file should exist in the catalogs directory
        catalog_path = os.path.join(isolated_data_dir, "catalogs", f"{local_catalog_uuid}.json")
        assert os.path.exists(catalog_path)
        with open(catalog_path, "r", encoding="utf-8") as f:
            stored_cat = json.load(f)
        assert stored_cat["catalog"]["controls"][0]["id"] == "corp-sec-1"

        # 5. Delete the profile and verify cleanup of local-controls catalog
        res_delete = client.delete(f"/api/documents/profiles/{prof_uuid}")
        assert res_delete.status_code == 200
        
        # The profile file should be deleted
        assert not os.path.exists(profile_path)
        # The local catalog file should also be cleaned up (unreferenced catalog)
        assert not os.path.exists(catalog_path)

    def test_live_preview_with_unsaved_local_controls(self, client, isolated_data_dir):
        # Live preview payload with in-memory local-controls before saving to disk
        preview_payload = {
            "profile": {
                "uuid": "44444444-4444-4444-4444-444444444444",
                "metadata": {"title": "Live Preview Profile", "version": "1.0.0"},
                "imports": [],
                "local-controls": [
                    {
                        "id": "corp-live-1",
                        "title": "Unsaved Live Control",
                        "parts": [
                            {
                                "id": "corp-live-1_smt",
                                "name": "statement",
                                "prose": "Live in-memory prose test."
                            }
                        ]
                    }
                ]
            }
        }

        res = client.post("/api/resolve/profile/preview", json=preview_payload)
        assert res.status_code == 200
        data = res.json()

        ctrl_ids = [c["id"] for c in data["controls"]]
        assert "corp-live-1" in ctrl_ids
        assert data["controls"][0]["parts"][0]["prose"] == "Live in-memory prose test."
        assert "corp-live-1" not in data["excluded_control_ids"]

