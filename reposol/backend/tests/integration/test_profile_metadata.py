"""
Integration tests for Profile metadata configuration (US 2.10, 2.14, 2.16).
"""
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileMetadata:
    """Tests for Profile metadata: title, version, parties, roles, and responsible parties."""

    def test_profile_metadata_configuration(self, client, isolated_data_dir):
        # Create base catalog
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Build profile with specific metadata fields (US 2.10, 2.16)
        party_uuid = str(uuid.uuid4())
        metadata_extras = {
            "title": "Custom Metadata Profile",
            "version": "2.1.0",
            "last-modified": "2026-07-19T12:00:00Z",
            "remarks": "Profile with complete metadata details",
            "roles": [
                {"id": "security-officer", "title": "Security Officer"},
                {"id": "system-owner", "title": "System Owner"}
            ],
            "parties": [
                {
                    "uuid": party_uuid,
                    "type": "person",
                    "name": "Jane Doe",
                    "email-addresses": ["jane.doe@example.com"],
                    "telephone-numbers": [
                        {
                            "type": "work",
                            "number": "+1-555-555-1234"
                        }
                    ]
                }
            ],
            "responsible-parties": [
                {
                    "role-id": "security-officer",
                    "party-uuids": [party_uuid]
                }
            ]
        }

        prof_doc = ProfileFactory.build(
            title="Temp Title", # Will be overridden by metadata_extras
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            metadata_extras=metadata_extras
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve and verify all metadata fields
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        meta = get_data["profile"]["metadata"]
        assert meta["title"] == "Custom Metadata Profile"
        assert meta["version"] == "2.1.0"
        assert meta["last-modified"] == "2026-07-19T12:00:00Z"
        assert meta["remarks"] == "Profile with complete metadata details"
        
        # Verify roles
        assert len(meta["roles"]) == 2
        role_ids = [r["id"] for r in meta["roles"]]
        assert "security-officer" in role_ids
        assert "system-owner" in role_ids

        # Verify parties and contact details
        assert len(meta["parties"]) == 1
        party = meta["parties"][0]
        assert party["uuid"] == party_uuid
        assert party["name"] == "Jane Doe"
        assert party["email-addresses"] == ["jane.doe@example.com"]
        assert party["telephone-numbers"][0]["number"] == "+1-555-555-1234"

        # Verify responsible parties
        assert len(meta["responsible-parties"]) == 1
        resp_party = meta["responsible-parties"][0]
        assert resp_party["role-id"] == "security-officer"
        assert resp_party["party-uuids"] == [party_uuid]
