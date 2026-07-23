"""
Integration tests for Catalog Metadata management features (US 1.1, US 1.10).
"""
import pytest
import uuid as uuid_module
from tests.factories import CatalogFactory

class TestCatalogMetadata:
    def test_us1_1_us1_10_create_catalog_with_metadata(self, client):
        # 1. Create catalog with rich metadata
        doc = CatalogFactory.with_metadata(title="Metadata Rich Catalog")
        uuid = doc["catalog"]["uuid"]
        
        # Populate party-uuids to satisfy schema validation constraint (minItems: 1)
        party_uuid = doc["catalog"]["metadata"]["parties"][0]["uuid"]
        doc["catalog"]["metadata"]["responsible-parties"][0]["party-uuids"] = [party_uuid]
        
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        # 2. Retrieve and assert metadata properties
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        metadata = saved_doc["catalog"]["metadata"]
        
        assert metadata["title"] == "Metadata Rich Catalog"
        assert metadata["version"] == "1.0.0"
        assert metadata["oscal-version"] == "1.1.2"
        assert metadata["published"] == "2026-01-01T00:00:00Z"
        assert metadata["remarks"] == "Full metadata catalog for testing"
        
        # Verify roles
        roles = metadata["roles"]
        assert len(roles) == 2
        assert any(r["id"] == "admin" and r["title"] == "Administrator" for r in roles)
        assert any(r["id"] == "auditor" and r["title"] == "Auditor" for r in roles)

        # Verify parties
        parties = metadata["parties"]
        assert len(parties) == 1
        assert parties[0]["type"] == "organization"
        assert parties[0]["name"] == "Test Organization"
        assert parties[0]["email-addresses"] == ["admin@test.org"]

        # Verify responsible-parties
        resp_parties = metadata["responsible-parties"]
        assert len(resp_parties) == 1
        assert resp_parties[0]["role-id"] == "admin"
        assert resp_parties[0]["party-uuids"] == [party_uuid]

    def test_us1_1_us1_10_update_metadata(self, client, saved_catalog):
        doc = CatalogFactory.with_metadata(title="Initial Title")
        party_uuid = doc["catalog"]["metadata"]["parties"][0]["uuid"]
        doc["catalog"]["metadata"]["responsible-parties"][0]["party-uuids"] = [party_uuid]
        
        uuid, _ = saved_catalog(
            title="Initial Title",
            metadata_extras=doc["catalog"]["metadata"]
        )

        # 1. Retrieve and update metadata fields
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        metadata = doc_to_update["catalog"]["metadata"]
        
        metadata["title"] = "Updated Title"
        metadata["version"] = "2.0.0"
        metadata["remarks"] = "Updated remarks"
        
        # Modify roles
        metadata["roles"].append({
            "id": "operator",
            "title": "Operator"
        })

        # Add locations
        location_uuid = str(uuid_module.uuid4())
        metadata["locations"] = [
            {
                "uuid": location_uuid,
                "title": "Primary Data Center",
                "address": {
                    "city": "Frankfurt",
                    "country": "Germany"
                }
            }
        ]

        # Save
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Retrieve and verify updates
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        updated_meta = updated_doc["catalog"]["metadata"]

        assert updated_meta["title"] == "Updated Title"
        assert updated_meta["version"] == "2.0.0"
        assert updated_meta["remarks"] == "Updated remarks"
        assert len(updated_meta["roles"]) == 3
        assert any(r["id"] == "operator" and r["title"] == "Operator" for r in updated_meta["roles"])
        assert len(updated_meta["locations"]) == 1
        assert updated_meta["locations"][0]["uuid"] == location_uuid
        assert updated_meta["locations"][0]["title"] == "Primary Data Center"

    def test_us1_1_us1_10_invalid_metadata_structure(self, client):
        # Build catalog with invalid metadata (e.g. party type is not "person" or "organization")
        doc = CatalogFactory.build(
            metadata_extras={
                "parties": [
                    {
                        "uuid": str(uuid_module.uuid4()),
                        "type": "invalid-type",  # Schema allows only "person" or "organization"
                        "name": "Invalid Party"
                    }
                ]
            }
        )
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
