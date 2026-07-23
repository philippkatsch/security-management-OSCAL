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
