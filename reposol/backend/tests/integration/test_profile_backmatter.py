"""
Integration tests for Profile back matter resources management (US 2.19, 2.21).
"""
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileBackMatter:
    """Tests for Profile back-matter resources, editing resources, and deleting resources."""

    def test_back_matter_lifecycle(self, client, isolated_data_dir):
        # Create base catalog
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 1. Create a profile with back-matter containing a resource (US 2.19)
        resource_uuid = str(uuid.uuid4())
        back_matter = {
            "resources": [
                {
                    "uuid": resource_uuid,
                    "title": "Initial Reference Guideline",
                    "description": "A PDF guide containing initial security rules",
                    "rlinks": [
                        {
                            "href": "https://example.com/initial_guide.pdf",
                            "media-type": "application/pdf"
                        }
                    ]
                }
            ]
        }

        prof_doc = ProfileFactory.build(
            title="Profile with Back Matter",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            back_matter=back_matter
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve and verify initial back matter
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        stored_back_matter = get_data["profile"]["back-matter"]
        assert len(stored_back_matter["resources"]) == 1
        res = stored_back_matter["resources"][0]
        assert res["uuid"] == resource_uuid
        assert res["title"] == "Initial Reference Guideline"
        assert res["description"] == "A PDF guide containing initial security rules"
        assert res["rlinks"][0]["href"] == "https://example.com/initial_guide.pdf"

        # 2. Update the profile: edit existing resource and add a new one (US 2.21)
        resource2_uuid = str(uuid.uuid4())
        updated_back_matter = {
            "resources": [
                {
                    "uuid": resource_uuid,
                    "title": "Updated Reference Guideline", # Edited title
                    "description": "Updated security rules description", # Edited description
                    "rlinks": [
                        {
                            "href": "https://example.com/updated_guide.pdf", # Edited href
                            "media-type": "application/pdf"
                        }
                    ]
                },
                {
                    "uuid": resource2_uuid,
                    "title": "Second Reference Document", # Added resource
                    "rlinks": [
                        {
                            "href": "https://example.com/second_doc.docx",
                            "media-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        }
                    ]
                }
            ]
        }

        prof_doc["profile"]["back-matter"] = updated_back_matter
        res_update = client.post("/api/documents/profiles", json=prof_doc)
        assert res_update.status_code == 200

        # Retrieve and verify updates
        res_get_updated = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get_updated.status_code == 200
        updated_data = res_get_updated.json()
        
        resources = updated_data["profile"]["back-matter"]["resources"]
        assert len(resources) == 2
        
        # Verify first resource edits
        r1 = [r for r in resources if r["uuid"] == resource_uuid][0]
        assert r1["title"] == "Updated Reference Guideline"
        assert r1["description"] == "Updated security rules description"
        assert r1["rlinks"][0]["href"] == "https://example.com/updated_guide.pdf"

        # Verify second resource addition
        r2 = [r for r in resources if r["uuid"] == resource2_uuid][0]
        assert r2["title"] == "Second Reference Document"

        # 3. Delete a resource from back matter (US 2.21)
        # Keep only the second resource in the update payload
        deleted_back_matter = {
            "resources": [
                {
                    "uuid": resource2_uuid,
                    "title": "Second Reference Document",
                    "rlinks": [
                        {
                            "href": "https://example.com/second_doc.docx",
                            "media-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        }
                    ]
                }
            ]
        }

        prof_doc["profile"]["back-matter"] = deleted_back_matter
        res_delete_resource = client.post("/api/documents/profiles", json=prof_doc)
        assert res_delete_resource.status_code == 200

        # Retrieve and verify deletion
        res_get_deleted = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get_deleted.status_code == 200
        deleted_data = res_get_deleted.json()
        
        final_resources = deleted_data["profile"]["back-matter"]["resources"]
        assert len(final_resources) == 1
        assert final_resources[0]["uuid"] == resource2_uuid
        assert not any(r["uuid"] == resource_uuid for r in final_resources)

    def test_resolve_profile_with_backmatter_resource_import(self, client, isolated_data_dir):
        """Verify profile resolution resolves imports pointing to back-matter resources with rlinks (R2-02)."""
        # 1. Create base catalog
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # 2. Create profile referencing back-matter resource #<res_uuid>
        res_uuid = str(uuid.uuid4())
        prof_doc = ProfileFactory.build(
            imports=[
                {
                    "href": f"#{res_uuid}",
                    "include-all": {}
                }
            ],
            back_matter={
                "resources": [
                    {
                        "uuid": res_uuid,
                        "title": "Base Catalog Resource",
                        "rlinks": [
                            {
                                "href": f"../catalogs/{cat_uuid}.json",
                                "media-type": "application/json"
                            }
                        ]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # 3. Resolve profile via API
        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 2
        assert {c["id"] for c in data["controls"]} == {"ac-1", "ac-2"}
        assert data["source_catalog_id"] == cat_uuid

    def test_resolve_profile_with_metadata_resource_import(self, client, isolated_data_dir):
        """Verify profile resolution resolves imports pointing to back-matter resources with API href rlinks (R2-02)."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "ia-1", "title": "Identification Policy"}]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        res_uuid = str(uuid.uuid4())
        prof_doc = ProfileFactory.build(
            imports=[{"href": f"#{res_uuid}", "include-all": {}}],
            back_matter={
                "resources": [
                    {
                        "uuid": res_uuid,
                        "title": "Back Matter Reference",
                        "rlinks": [{"href": f"/api/documents/catalogs/{cat_uuid}"}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 1
        assert data["controls"][0]["id"] == "ia-1"

