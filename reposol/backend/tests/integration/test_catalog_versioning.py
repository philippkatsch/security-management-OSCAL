"""
Integration tests for Catalog Versioning and Draft Management (US 1.8).
"""
import pytest
from tests.factories import CatalogFactory

class TestCatalogVersioning:
    def test_us1_8_save_draft_version(self, client):
        # 1. Build a catalog doc (not saved as active yet)
        doc = CatalogFactory.build(title="Draft Catalog", version="0.1.0")
        uuid = doc["catalog"]["uuid"]
        
        # 2. Save as draft
        res = client.post(f"/api/documents/catalog/{uuid}/versions?is_draft=true", json=doc)
        assert res.status_code == 200
        assert res.json() == {"status": "success", "version": "0.1.0"}

        # 3. Retrieve draft version and verify it exists
        res_get = client.get(f"/api/documents/catalog/{uuid}/versions/0.1.0-draft")
        assert res_get.status_code == 200
        assert res_get.json()["catalog"]["metadata"]["title"] == "Draft Catalog"

        # Verify that active file was NOT created
        res_active = client.get(f"/api/documents/catalog/{uuid}")
        # Note: get_document falls back to draft if active doesn't exist, let's verify if get_document has draft fallback in app/storage.py
        # Yes, "if os.path.isfile(draft_file_path): file_path = draft_file_path".
        # Let's verify via the list of versions that it's marked as draft.
        res_list = client.get(f"/api/documents/catalog/{uuid}/versions")
        assert res_list.status_code == 200
        versions = res_list.json()
        assert len(versions) == 1
        assert versions[0]["is_draft"] is True
        assert versions[0]["version"] == "0.1.0-draft"

    def test_us1_8_save_release_version_and_revision_tracking(self, client):
        # 1. Save an active catalog (1.0.0)
        doc = CatalogFactory.build(title="Release Catalog 1.0.0", version="1.0.0")
        uuid = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)

        # 2. Post a release version (1.1.0) with remarks
        doc["catalog"]["metadata"]["version"] = "1.1.0"
        doc["catalog"]["metadata"]["title"] = "Release Catalog 1.1.0"
        res = client.post(
            f"/api/documents/catalog/{uuid}/versions?remarks=Feature%20additions&is_draft=false",
            json=doc
        )
        assert res.status_code == 200

        # 3. Retrieve versions list
        res_list = client.get(f"/api/documents/catalog/{uuid}/versions")
        versions = res_list.json()
        # Should have 1.1.0 (release version) and 1.0.0 (active version since saving 1.0.0 creates it, 
        # and active version lists as fallback if not in files)
        assert any(v["version"] == "1.1.0" and v["remarks"] == "Feature additions" for v in versions)

        # 4. Get specific version JSON
        res_get_v110 = client.get(f"/api/documents/catalog/{uuid}/versions/1.1.0")
        assert res_get_v110.status_code == 200
        v110_doc = res_get_v110.json()
        
        # Verify automatic revision tracking (revision entry prepended in metadata)
        revisions = v110_doc["catalog"]["metadata"].get("revisions", [])
        assert len(revisions) > 0
        assert revisions[0]["version"] == "1.1.0"
        assert revisions[0]["remarks"] == "Feature additions"

    def test_us1_8_delete_version(self, client):
        # 1. Create a release version and a draft version
        doc = CatalogFactory.build(title="Versioned Catalog", version="2.0.0")
        uuid = doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=doc)
        
        # Save a release version v2.0.0
        client.post(f"/api/documents/catalog/{uuid}/versions?is_draft=false&remarks=v2", json=doc)
        
        # Save a second release version v2.0.1 (which updates the active document version to 2.0.1)
        doc["catalog"]["metadata"]["version"] = "2.0.1"
        client.post(f"/api/documents/catalog/{uuid}/versions?is_draft=false&remarks=v2.0.1", json=doc)
        
        # Save a draft version v2.1.0
        doc["catalog"]["metadata"]["version"] = "2.1.0"
        client.post(f"/api/documents/catalog/{uuid}/versions?is_draft=true", json=doc)

        # Verify all exist
        res_list = client.get(f"/api/documents/catalog/{uuid}/versions")
        assert len(res_list.json()) >= 3

        # 2. Delete the draft version
        res_del_draft = client.delete(f"/api/documents/catalog/{uuid}/versions/2.1.0-draft")
        assert res_del_draft.status_code == 200

        # Verify draft is gone but others are still there
        res_list_after = client.get(f"/api/documents/catalog/{uuid}/versions")
        versions_after = res_list_after.json()
        assert not any(v["version"] == "2.1.0-draft" for v in versions_after)
        assert any(v["version"] == "2.0.0" for v in versions_after)
        assert any(v["version"] == "2.0.1" for v in versions_after)

        # 3. Delete the release version 2.0.0 (which is NOT the active version 2.0.1)
        res_del_release = client.delete(f"/api/documents/catalog/{uuid}/versions/2.0.0")
        assert res_del_release.status_code == 200
        
        # Verify it returns 404 now (since active file is 2.0.1, fallback won't match 2.0.0)
        res_get_deleted = client.get(f"/api/documents/catalog/{uuid}/versions/2.0.0")
        assert res_get_deleted.status_code == 404
