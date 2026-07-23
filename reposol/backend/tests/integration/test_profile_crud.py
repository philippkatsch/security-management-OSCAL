"""
Integration tests for Profile CRUD operations (US 2.1).
"""
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileCRUD:
    """Tests for Profile Create, Read, Update, and Delete operations."""

    def test_profile_lifecycle_happy_path(self, client, isolated_data_dir):
        # 1. Create a catalog first, because profiles usually import catalogs
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # 2. Create the profile (importing the catalog)
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="My Custom Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        
        # Save (Create) - Expect 201
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201
        res_save_data = res_save.json()
        assert res_save_data["profile"]["uuid"] == prof_uuid
        assert res_save_data["profile"]["metadata"]["title"] == "My Custom Profile"

        # 3. List profiles
        res_list = client.get("/api/documents/profiles")
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert any(p["profile"]["uuid"] == prof_uuid for p in list_data)

        # 4. Get individual profile details
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        assert get_data["profile"]["uuid"] == prof_uuid
        assert get_data["profile"]["metadata"]["title"] == "My Custom Profile"

        # 5. Update the profile - Expect 200
        prof_doc["profile"]["metadata"]["title"] = "My Updated Profile"
        res_update = client.post("/api/documents/profiles", json=prof_doc)
        assert res_update.status_code == 200
        update_data = res_update.json()
        assert update_data["profile"]["metadata"]["title"] == "My Updated Profile"

        # Verify via GET that it updated
        res_get_updated = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get_updated.json()["profile"]["metadata"]["title"] == "My Updated Profile"

        # 6. Delete the profile - Expect 200
        res_delete = client.delete(f"/api/documents/profiles/{prof_uuid}")
        assert res_delete.status_code == 200
        assert res_delete.json()["status"] == "success"

        # Verify it is gone
        res_get_gone = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get_gone.status_code == 404

    def test_profile_crud_errors(self, client, isolated_data_dir):
        # Retrieve non-existent profile
        fake_uuid = str(uuid.uuid4())
        res_get = client.get(f"/api/documents/profiles/{fake_uuid}")
        assert res_get.status_code == 404

        # Delete non-existent profile
        res_delete = client.get(f"/api/documents/profiles/{fake_uuid}")
        assert res_delete.status_code == 404

        # Save profile with invalid UUID format
        bad_uuid = "not-a-valid-uuid"
        bad_prof = ProfileFactory.build(doc_id=bad_uuid)
        res_save = client.post("/api/documents/profiles", json=bad_prof)
        assert res_save.status_code == 400

        # Save profile with missing UUID field (must trigger a validation/missing key error)
        missing_uuid_prof = ProfileFactory.build()
        del missing_uuid_prof["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=missing_uuid_prof)
        assert res_save.status_code == 400

    def test_delete_profile_integrity_check(self, client, isolated_data_dir):
        # Create a catalog and profile
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # Create a schema-compliant SSP referencing the profile
        ssp_doc = {
            "system-security-plan": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Test SSP",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "import-profile": {"href": f"../profiles/{prof_uuid}.json"},
                "system-characteristics": {
                    "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                    "system-name": "Test System",
                    "description": "Test System Description",
                    "system-information": {
                        "information-types": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "title": "Information Title",
                                "description": "Information Description"
                            }
                        ]
                    },
                    "status": {"state": "operational"},
                    "authorization-boundary": {
                        "description": "Boundary description"
                    }
                },
                "system-implementation": {
                    "users": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "role-ids": ["provider"]
                        }
                    ],
                    "components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "type": "software",
                            "title": "Mock Component",
                            "description": "Mock Component Description",
                            "status": {"state": "operational"}
                        }
                    ]
                },
                "control-implementation": {
                    "description": "Control Implementation Description",
                    "implemented-requirements": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "control-id": "ac-1"
                        }
                    ]
                }
            }
        }
        
        # Save the SSP
        res_ssp = client.post("/api/documents/ssps", json=ssp_doc)
        assert res_ssp.status_code == 201

        # Delete the profile without force (default force=false) - should fail with 409
        res_delete_fail = client.delete(f"/api/documents/profiles/{prof_uuid}")
        assert res_delete_fail.status_code == 409
        assert "referenziert" in res_delete_fail.json()["detail"] or "referenced" in res_delete_fail.json()["detail"]

        # Delete with force=true - should succeed
        res_delete_success = client.delete(f"/api/documents/profiles/{prof_uuid}?force=true")
        assert res_delete_success.status_code == 200
