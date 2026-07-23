"""
Integration tests for application security, directory traversal prevention, and UUID injection (US Stage/Security).
"""
import pytest
from unittest.mock import patch

class TestSecurityIntegration:

    def test_us_security_traversal_via_uuid_validation(self, client):
        """Verify that directory traversal payloads in GET/DELETE endpoints are blocked by UUID validation."""
        traversal_paths = [
            "a123bcde-1234-5678-abcd-000000000001\\..\\..\\etc\\passwd",
            "a123bcde-1234-5678-abcd-000000000001\\..\\..\\windows\\win.ini",
        ]
        
        for path in traversal_paths:
            # 1. GET doc endpoint
            res_get = client.get(f"/api/documents/catalogs/{path}")
            assert res_get.status_code == 400
            assert "Invalid UUID" in res_get.json()["detail"]

            # 2. DELETE doc endpoint
            res_del = client.delete(f"/api/documents/catalogs/{path}")
            assert res_del.status_code == 400
            assert "Invalid UUID" in res_del.json()["detail"]

            # 3. GET export endpoint
            res_exp = client.get(f"/api/export/catalogs/{path}")
            assert res_exp.status_code == 400
            assert "Invalid UUID" in res_exp.json()["detail"]

    def test_us_security_uuid_injection_in_document_save(self, client):
        """Verify that saving a document with a non-UUID/traversal payload inside the document body is rejected."""
        # catalog doc with traversal path in UUID
        invalid_body = {
            "catalog": {
                "uuid": "a123bcde-1234-5678-abcd-000000000001\\..\\..\\etc\\passwd",
                "metadata": {
                    "title": "Malicious Catalog",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        res = client.post("/api/documents/catalogs", json=invalid_body)
        assert res.status_code == 400
        assert "Invalid UUID" in res.json()["detail"] or "Validation failed" in res.json()["detail"]

    def test_us_security_bypass_uuid_validation_traversal_get(self, client):
        """Verify that even if UUID validation is mocked/bypassed, get_document blocks traversal and returns 400."""
        traversal_doc_id = "a123bcde-1234-5678-abcd-000000000001\\..\\..\\etc\\passwd"
        
        # Patch is_valid_uuid in routes and storage to return True
        with patch("app.routes.is_valid_uuid", return_value=True), \
             patch("app.storage.is_valid_uuid", return_value=True):
            
            res = client.get(f"/api/documents/catalogs/{traversal_doc_id}")
            assert res.status_code == 400
            assert "Directory traversal" in res.json()["detail"]

    def test_us_security_bypass_uuid_validation_traversal_save(self, client):
        """Verify that even if UUID validation and schema validation are mocked, save_document blocks traversal and returns 400."""
        traversal_doc_id = "a123bcde-1234-5678-abcd-000000000001\\..\\..\\etc\\passwd"
        doc = {
            "catalog": {
                "uuid": traversal_doc_id,
                "metadata": {
                    "title": "Bypassed Catalog",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        
        with patch("app.routes.is_valid_uuid", return_value=True), \
             patch("app.storage.is_valid_uuid", return_value=True), \
             patch("app.routes.validate_document", return_value=None):
            
            res = client.post(f"/api/documents/catalogs", json=doc)
            assert res.status_code == 400
            assert "Directory traversal" in res.json()["detail"]

    def test_us_security_bypass_uuid_validation_traversal_delete(self, client):
        """Verify that even if UUID validation is mocked/bypassed, delete_document blocks traversal."""
        traversal_doc_id = "a123bcde-1234-5678-abcd-000000000001\\..\\..\\etc\\passwd"
        
        with patch("app.routes.is_valid_uuid", return_value=True), \
             patch("app.storage.is_valid_uuid", return_value=True):
            
            res = client.delete(f"/api/documents/catalogs/{traversal_doc_id}")
            assert res.status_code == 400
            assert "Directory traversal" in res.json()["detail"]

    def test_us_security_version_traversal(self, client):
        """Verify that version endpoints protect against directory traversal in the version name."""
        valid_uuid = "a123bcde-1234-5678-abcd-000000000001"
        traversal_version = "..\\..\\..\\outside"

        # 1. GET specific version
        res_get = client.get(f"/api/documents/catalogs/{valid_uuid}/versions/{traversal_version}")
        assert res_get.status_code in (400, 404)
        if res_get.status_code == 400:
            assert "Directory traversal" in res_get.json()["detail"]

        # 2. DELETE specific version
        res_del = client.delete(f"/api/documents/catalogs/{valid_uuid}/versions/{traversal_version}")
        assert res_del.status_code in (400, 404)
        if res_del.status_code == 400:
            assert "Directory traversal" in res_del.json()["detail"]
