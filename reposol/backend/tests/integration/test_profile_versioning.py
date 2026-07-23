"""
Integration tests for Profile versioning and revision tracking (US 2.13).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileVersioning:
    """Tests for Profile versioning endpoints, draft flags, and auto revision tracking."""

    def test_versioning_lifecycle(self, client, isolated_data_dir):
        # 1. Create a catalog first
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Create the main profile document
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        # 3. Save official version 1.0.0
        prof_doc["profile"]["metadata"]["version"] = "1.0.0"
        res_v1 = client.post(
            f"/api/documents/profiles/{prof_uuid}/versions?remarks=Release%201.0.0&is_draft=false",
            json=prof_doc
        )
        assert res_v1.status_code == 200
        assert res_v1.json() == {"status": "success", "version": "1.0.0"}

        # 4. Save official version 1.1.0
        prof_doc["profile"]["metadata"]["version"] = "1.1.0"
        res_v2 = client.post(
            f"/api/documents/profiles/{prof_uuid}/versions?remarks=Release%201.1.0&is_draft=false",
            json=prof_doc
        )
        assert res_v2.status_code == 200

        # 5. Save draft version 2.0.0-draft (should NOT add to revisions history)
        prof_doc["profile"]["metadata"]["version"] = "2.0.0-draft"
        res_v3 = client.post(
            f"/api/documents/profiles/{prof_uuid}/versions?is_draft=true",
            json=prof_doc
        )
        assert res_v3.status_code == 200

        # 6. List all versions
        res_list = client.get(f"/api/documents/profiles/{prof_uuid}/versions")
        assert res_list.status_code == 200
        versions_list = res_list.json()
        assert len(versions_list) == 3
        
        # Verify details in list
        versions = [v["version"] for v in versions_list]
        assert "1.0.0" in versions
        assert "1.1.0" in versions
        assert "2.0.0-draft" in versions

        # Check drafts flag in list using fallback default value (False)
        drafts = {v["version"]: v.get("is_draft", False) for v in versions_list}
        assert drafts["1.0.0"] is False
        assert drafts["1.1.0"] is False
        assert drafts["2.0.0-draft"] is True

        # 7. Get individual version 1.1.0
        res_get_v1_1 = client.get(f"/api/documents/profiles/{prof_uuid}/versions/1.1.0")
        assert res_get_v1_1.status_code == 200
        v1_1_data = res_get_v1_1.json()
        assert v1_1_data["profile"]["metadata"]["version"] == "1.1.0"
        
        # Check automatic revision tracking: revision should be prepended
        revisions = v1_1_data["profile"]["metadata"]["revisions"]
        assert len(revisions) >= 1
        assert revisions[0]["version"] == "1.1.0"
        assert revisions[0]["remarks"] == "Release 1.1.0"

        # Get individual version 2.0.0-draft (should not contain itself in revisions)
        res_get_draft = client.get(f"/api/documents/profiles/{prof_uuid}/versions/2.0.0-draft")
        assert res_get_draft.status_code == 200
        draft_data = res_get_draft.json()
        # The revision tracking was skipped, so the first revision in history is the previous one (1.1.0)
        revisions_draft = draft_data["profile"]["metadata"].get("revisions", [])
        assert not any(rev["version"] == "2.0.0-draft" for rev in revisions_draft)

        # 8. Delete version 1.0.0
        res_delete_v1 = client.delete(f"/api/documents/profiles/{prof_uuid}/versions/1.0.0")
        assert res_delete_v1.status_code == 200
        assert res_delete_v1.json()["status"] == "success"

        # Delete draft version 2.0.0-draft
        res_delete_draft = client.delete(f"/api/documents/profiles/{prof_uuid}/versions/2.0.0-draft")
        assert res_delete_draft.status_code == 200

        # Verify remaining version is only 1.1.0 (and the active main profile)
        res_list_after = client.get(f"/api/documents/profiles/{prof_uuid}/versions")
        versions_after = [v["version"] for v in res_list_after.json()]
        assert "1.0.0" not in versions_after
        assert "2.0.0-draft" not in versions_after
        assert "1.1.0" in versions_after

        # 9. Delete main document and check that all remaining versions are deleted
        res_delete_main = client.delete(f"/api/documents/profiles/{prof_uuid}")
        assert res_delete_main.status_code == 200
        
        # Verify listing versions now returns 200 with an empty list because the main doc and all versions are deleted
        res_list_gone = client.get(f"/api/documents/profiles/{prof_uuid}/versions")
        assert res_list_gone.status_code == 200
        assert res_list_gone.json() == []
