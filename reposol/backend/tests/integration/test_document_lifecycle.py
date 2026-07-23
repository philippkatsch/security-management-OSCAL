"""
Integration tests for document lifecycle and deletion reference integrity (US 0.6).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestDocumentLifecycleIntegration:

    def test_us0_6_deletion_reference_integrity_and_force(self, client, isolated_data_dir, saved_catalog, saved_profile):
        """Verify delete operations respect reference integrity and support force override."""
        # 1. Create a catalog C1
        cat_id, cat_doc = saved_catalog(title="Referenced Catalog")
        
        # 2. Create a profile P1 that imports C1
        prof_id, prof_doc = saved_profile(catalog_uuid=cat_id, title="Referencing Profile")

        # 3. Attempt to delete catalog C1 without force should fail with 409 Conflict
        delete_res = client.delete(f"/api/documents/catalogs/{cat_id}")
        assert delete_res.status_code == 409
        detail = delete_res.json()["detail"]
        assert "referenced" in detail
        assert "Referencing Profile" in detail

        # Attempt to delete catalog C1 with force=false should also fail with 409 Conflict
        delete_res_false = client.delete(f"/api/documents/catalogs/{cat_id}?force=false")
        assert delete_res_false.status_code == 409

        # 4. Attempt to delete catalog C1 with force=true should succeed
        delete_res_force = client.delete(f"/api/documents/catalogs/{cat_id}?force=true")
        assert delete_res_force.status_code == 200
        assert delete_res_force.json()["status"] == "success"

        # Verify C1 is deleted
        get_cat = client.get(f"/api/documents/catalogs/{cat_id}")
        assert get_cat.status_code == 404

        # 5. Delete profile P1 (not referenced by anything) with force=false should succeed
        delete_prof = client.delete(f"/api/documents/profiles/{prof_id}")
        assert delete_prof.status_code == 200
        assert delete_prof.json()["status"] == "success"

        # Verify P1 is deleted
        get_prof = client.get(f"/api/documents/profiles/{prof_id}")
        assert get_prof.status_code == 404

    def test_us0_6_delete_non_existent_document(self, client):
        """Verify deleting a non-existent document returns 404."""
        non_existent_uuid = "00000000-0000-0000-0000-999999999999"
        res = client.delete(f"/api/documents/catalogs/{non_existent_uuid}")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_us0_6_delete_invalid_uuid(self, client):
        """Verify deleting with an invalid UUID returns 400."""
        res = client.delete("/api/documents/catalogs/invalid-uuid")
        assert res.status_code == 400
        assert "Invalid UUID" in res.json()["detail"]
