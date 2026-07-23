"""
Integration tests for Catalog Schema Validation and Error Reporting (US 1.7).
"""
import pytest
import uuid as uuid_module
from tests.factories import CatalogFactory

class TestCatalogValidation:
    def test_us1_7_validate_valid_catalog(self, client):
        # 1. POST valid catalog to validation endpoint
        doc = CatalogFactory.build(title="Valid Catalog")
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 200
        assert res.json() == {"status": "valid", "stage": "catalogs"}

        # 2. POST valid catalog to saving endpoint
        res_save = client.post("/api/documents/catalog", json=doc)
        assert res_save.status_code == 201

    def test_us1_7_validate_invalid_catalog_missing_root_key(self, client):
        # Missing "catalog" root key
        doc = {"metadata": {"title": "No Root Key"}}
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 400
        assert "missing required root key" in res.json()["detail"].lower()

    def test_us1_7_validate_invalid_catalog_missing_uuid(self, client):
        # Missing "uuid" under "catalog"
        doc = CatalogFactory.build()
        del doc["catalog"]["uuid"]
        
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
        # Verify specific error details are returned
        errors = res.json().get("errors", [])
        assert len(errors) > 0
        assert any("uuid" in err["message"] for err in errors)

    def test_us1_7_validate_invalid_catalog_invalid_uuid_format(self, client):
        # Invalid UUID format
        doc = CatalogFactory.build(doc_id="not-a-valid-uuid-format")
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
        errors = res.json().get("errors", [])
        assert len(errors) > 0
        assert any("uuid" in err["path"] for err in errors)

    def test_us1_7_validate_invalid_catalog_missing_metadata(self, client):
        # Missing "metadata" key
        doc = CatalogFactory.build()
        del doc["catalog"]["metadata"]
        
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()

    def test_us1_7_validate_invalid_catalog_empty_title(self, client):
        # Empty title (enforced via minLength: 1 customization)
        doc = CatalogFactory.build(title="")
        res = client.post("/api/validate/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
        errors = res.json().get("errors", [])
        assert len(errors) > 0
        assert any("title" in err["path"] for err in errors)

    def test_us1_7_validate_invalid_json_body(self, client):
        # Invalid JSON body (e.g. malformed JSON string)
        res = client.post(
            "/api/validate/catalog", 
            content="{'invalid-json': }", 
            headers={"Content-Type": "application/json"}
        )
        assert res.status_code == 400
        assert "invalid json body" in res.json()["detail"].lower()
