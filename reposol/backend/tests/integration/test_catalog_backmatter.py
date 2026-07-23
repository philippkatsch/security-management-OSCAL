"""
Integration tests for Catalog Back-matter resource management (US 1.12).
"""
import pytest
import uuid as uuid_module
from tests.factories import CatalogFactory

class TestCatalogBackmatter:
    def test_us1_12_create_catalog_with_back_matter(self, client):
        # 1. Create a catalog with back-matter resources
        doc = CatalogFactory.with_back_matter()
        uuid = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        # 2. Retrieve and assert back-matter fields
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        back_matter = saved_doc["catalog"]["back-matter"]
        
        resources = back_matter["resources"]
        assert len(resources) == 1
        assert resources[0]["title"] == "Reference Document"
        assert resources[0]["description"] == "A test reference document"
        
        rlinks = resources[0]["rlinks"]
        assert len(rlinks) == 1
        assert rlinks[0]["href"] == "https://example.com/doc.pdf"
        assert rlinks[0]["media-type"] == "application/pdf"

    def test_us1_12_update_back_matter_resources(self, client, saved_catalog):
        doc = CatalogFactory.with_back_matter()
        uuid, _ = saved_catalog(back_matter=doc["catalog"]["back-matter"])

        # 1. Retrieve and modify back-matter
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        back_matter = doc_to_update["catalog"]["back-matter"]
        resource = back_matter["resources"][0]

        # Modify first resource
        resource["title"] = "Updated Reference Title"
        resource["rlinks"][0]["href"] = "https://example.com/updated_doc.pdf"

        # Add a second resource
        new_resource_uuid = str(uuid_module.uuid4())
        back_matter["resources"].append({
            "uuid": new_resource_uuid,
            "title": "Additional Resource",
            "description": "Another reference file",
            "rlinks": [
                {
                    "href": "https://example.com/info.html",
                    "media-type": "text/html"
                }
            ]
        })

        # Save
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Retrieve and verify changes
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        updated_resources = updated_doc["catalog"]["back-matter"]["resources"]

        assert len(updated_resources) == 2
        assert updated_resources[0]["title"] == "Updated Reference Title"
        assert updated_resources[0]["rlinks"][0]["href"] == "https://example.com/updated_doc.pdf"
        assert any(r["uuid"] == new_resource_uuid and r["title"] == "Additional Resource" for r in updated_resources)

    def test_us1_12_delete_resource(self, client, saved_catalog):
        doc = CatalogFactory.with_back_matter()
        uuid, _ = saved_catalog(back_matter=doc["catalog"]["back-matter"])

        # 1. Retrieve and delete back-matter resources
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        
        # Delete back-matter entirely
        if "back-matter" in doc_to_update["catalog"]:
            del doc_to_update["catalog"]["back-matter"]

        # Save
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Retrieve and verify
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        assert "back-matter" not in updated_doc["catalog"]

    def test_us1_12_invalid_back_matter_structure(self, client):
        # Build catalog with invalid back-matter (missing uuid in resource)
        doc = CatalogFactory.build(
            back_matter={
                "resources": [
                    {
                        "title": "Resource with no UUID"
                    }
                ]
            }
        )
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
