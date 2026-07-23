"""
Integration tests for Catalog Group management features (US 1.2).
"""
import pytest
from tests.factories import CatalogFactory

class TestCatalogGroups:
    def test_us1_2_create_catalog_with_groups(self, client):
        # 1. Create a catalog with a nested group hierarchy
        doc = CatalogFactory.with_groups()
        uuid = doc["catalog"]["uuid"]
        
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201
        
        # 2. Retrieve and assert group structure
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        groups = saved_doc["catalog"]["groups"]
        assert len(groups) == 2
        assert groups[0]["id"] == "ac"
        assert groups[0]["title"] == "Access Control"
        assert len(groups[0]["groups"]) == 1
        assert groups[0]["groups"][0]["id"] == "ac-ia"
        assert groups[1]["id"] == "au"

    def test_us1_2_update_group_structure(self, client, saved_catalog):
        # 1. Build initial catalog with groups
        doc = CatalogFactory.with_groups()
        uuid, _ = saved_catalog(groups=doc["catalog"]["groups"])
        
        # 2. Modify group structure: rename group and add a new subgroup
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        
        # Rename 'Access Control' to 'Access Control & Authentication'
        doc_to_update["catalog"]["groups"][0]["title"] = "Access Control & Authentication"
        
        # Add new subgroup under 'Access Control'
        doc_to_update["catalog"]["groups"][0]["groups"].append({
            "id": "ac-sub2",
            "title": "Subgroup Two"
        })
        
        # Save updated catalog
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200
        
        # 3. Retrieve and verify
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        groups = updated_doc["catalog"]["groups"]
        assert groups[0]["title"] == "Access Control & Authentication"
        subgroups = groups[0]["groups"]
        assert len(subgroups) == 2
        assert any(sub["id"] == "ac-sub2" and sub["title"] == "Subgroup Two" for sub in subgroups)

    def test_us1_2_delete_group(self, client, saved_catalog):
        doc = CatalogFactory.with_groups()
        uuid, _ = saved_catalog(groups=doc["catalog"]["groups"])
        
        # 1. Retrieve
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        
        # 2. Remove the second group 'au'
        groups = doc_to_update["catalog"]["groups"]
        doc_to_update["catalog"]["groups"] = [g for g in groups if g["id"] != "au"]
        
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200
        
        # 3. Verify
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        assert len(updated_doc["catalog"]["groups"]) == 1
        assert updated_doc["catalog"]["groups"][0]["id"] == "ac"

    def test_us1_2_invalid_group_structure(self, client):
        # Build catalog with invalid group structure (missing title in group)
        doc = CatalogFactory.build(
            groups=[
                {
                    "id": "invalid-group"
                    # missing title
                }
            ]
        )
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
