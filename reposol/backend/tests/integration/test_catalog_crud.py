"""
Integration tests for Catalog CRUD operations (US 1.9).
"""
import pytest
from tests.factories import CatalogFactory

class TestCatalogCrud:
    def test_us1_9_create_and_read_catalog(self, client):
        # 1. Create a new catalog
        catalog_doc = CatalogFactory.build(title="CRUD Catalog")
        uuid = catalog_doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=catalog_doc)
        assert res.status_code == 201
        
        # 2. Get and verify
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        assert res_get.json()["catalog"]["metadata"]["title"] == "CRUD Catalog"

    def test_us1_9_update_catalog(self, client, saved_catalog):
        uuid, doc = saved_catalog(title="Old Title")
        doc["catalog"]["metadata"]["title"] = "New Title"
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 200
        
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.json()["catalog"]["metadata"]["title"] == "New Title"

    def test_us1_9_list_catalogs(self, client, saved_catalog):
        uuid1, _ = saved_catalog(title="Cat 1")
        uuid2, _ = saved_catalog(title="Cat 2")
        res = client.get("/api/documents/catalog")
        assert res.status_code == 200
        items = res.json()
        uuids = [item["catalog"]["uuid"] for item in items]
        assert uuid1 in uuids
        assert uuid2 in uuids

    def test_us1_9_delete_catalog(self, client):
        catalog_doc = CatalogFactory.build(title="To Delete")
        uuid = catalog_doc["catalog"]["uuid"]
        client.post("/api/documents/catalog", json=catalog_doc)
        
        res = client.delete(f"/api/documents/catalog/{uuid}")
        assert res.status_code == 200
        
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 404

    def test_us1_9_delete_nonexistent_returns_404(self, client):
        import uuid as uuid_module
        nonexistent_uuid = str(uuid_module.uuid4())
        res = client.delete(f"/api/documents/catalog/{nonexistent_uuid}")
        assert res.status_code == 404

    def test_us1_9_delete_with_referrers(self, client, saved_catalog, saved_profile):
        cat_uuid, cat_doc = saved_catalog(title="Referenced Catalog")
        prof_uuid, prof_doc = saved_profile(catalog_uuid=cat_uuid, title="Referencing Profile")
        
        # Deleting the catalog without force=true should return 409 Conflict due to references
        res = client.delete(f"/api/documents/catalog/{cat_uuid}")
        assert res.status_code == 409
        detail = res.json()["detail"]
        assert "referenziert" in detail or "Referencing Profile" in detail or prof_uuid in detail
        
        # Deleting with force=true should succeed
        res_force = client.delete(f"/api/documents/catalog/{cat_uuid}?force=true")
        assert res_force.status_code == 200
