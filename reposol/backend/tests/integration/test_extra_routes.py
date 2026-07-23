"""
Integration tests targeting specific error response branches and edge cases in routes.py
to achieve maximum test coverage.
"""
import uuid
import pytest


def generate_uuid() -> str:
    return str(uuid.uuid4())


class TestExtraRoutesAndErrors:
    """Tests various error branches, HTTP status codes, and the health check."""

    def test_health_check(self, client):
        """GET /health returns 200 OK."""
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

    def test_invalid_stage_handling(self, client):
        """Requesting an invalid stage returns 400 Bad Request."""
        res = client.get("/api/documents/invalid_stage_name")
        assert res.status_code == 400
        assert "invalid stage" in res.json()["detail"].lower()

    def test_get_document_invalid_uuid(self, client):
        """GET /api/documents/{stage}/{doc_id} with invalid UUID format returns 400."""
        res = client.get("/api/documents/catalog/not-a-valid-uuid")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_get_document_not_found(self, client):
        """GET /api/documents/{stage}/{doc_id} for nonexistent UUID returns 404."""
        nonexistent_uuid = generate_uuid()
        res = client.get(f"/api/documents/catalog/{nonexistent_uuid}")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_delete_document_invalid_uuid(self, client):
        """DELETE /api/documents/{stage}/{doc_id} with invalid UUID format returns 400."""
        res = client.delete("/api/documents/catalog/not-a-valid-uuid")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_delete_document_not_found(self, client):
        """DELETE /api/documents/{stage}/{doc_id} for nonexistent UUID returns 404."""
        nonexistent_uuid = generate_uuid()
        res = client.delete(f"/api/documents/catalog/{nonexistent_uuid}")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_save_document_invalid_json(self, client):
        """POST /api/documents/{stage} with invalid/malformed JSON body returns 400."""
        res = client.post(
            "/api/documents/catalog",
            content="this is not JSON data, it is a plain text string",
            headers={"Content-Type": "application/json"}
        )
        assert res.status_code == 400
        assert "invalid json body" in res.json()["detail"].lower()

    def test_save_document_missing_uuid(self, client, monkeypatch):
        """POST /api/documents/{stage} with missing UUID in document root returns 400."""
        # Patch schema validation so it passes, enabling us to hit the route's custom UUID checks
        monkeypatch.setattr("app.routes.validate_document", lambda *args, **kwargs: None)
        
        invalid_doc = {
            "catalog": {
                # Missing uuid
                "metadata": {
                    "title": "Missing UUID Catalog",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        res = client.post("/api/documents/catalog", json=invalid_doc)
        assert res.status_code == 400
        assert "missing uuid under root key" in res.json()["detail"].lower()

    def test_save_document_invalid_uuid_format(self, client, monkeypatch):
        """POST /api/documents/{stage} with invalid UUID format inside payload returns 400."""
        # Patch schema validation so it passes, enabling us to hit the route's custom UUID format checks
        monkeypatch.setattr("app.routes.validate_document", lambda *args, **kwargs: None)
        
        invalid_doc = {
            "catalog": {
                "uuid": "invalid-uuid-format-here",
                "metadata": {
                    "title": "Invalid UUID Format Catalog",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        res = client.post("/api/documents/catalog", json=invalid_doc)
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_list_versions_invalid_uuid(self, client):
        """GET /api/documents/{stage}/{doc_id}/versions with invalid UUID returns 400."""
        res = client.get("/api/documents/catalog/not-a-valid-uuid/versions")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_get_version_invalid_uuid(self, client):
        """GET /api/documents/{stage}/{doc_id}/versions/{version} with invalid UUID returns 400."""
        res = client.get("/api/documents/catalog/not-a-valid-uuid/versions/1.0.0")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_get_version_not_found(self, client):
        """GET /api/documents/{stage}/{doc_id}/versions/{version} returns 404 if nonexistent."""
        doc_uuid = generate_uuid()
        res = client.get(f"/api/documents/catalog/{doc_uuid}/versions/9.9.9")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_delete_version_invalid_uuid(self, client):
        """DELETE /api/documents/{stage}/{doc_id}/versions/{version} with invalid UUID returns 400."""
        res = client.delete("/api/documents/catalog/not-a-valid-uuid/versions/1.0.0")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_delete_version_not_found(self, client):
        """DELETE /api/documents/{stage}/{doc_id}/versions/{version} returns 404 if nonexistent."""
        doc_uuid = generate_uuid()
        res = client.get(f"/api/documents/catalog/{doc_uuid}/versions/9.9.9")
        assert res.status_code == 404

    def test_save_version_invalid_uuid(self, client):
        """POST /api/documents/{stage}/{doc_id}/versions with invalid UUID returns 400."""
        res = client.post("/api/documents/catalog/not-a-valid-uuid/versions", json={})
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_save_version_invalid_json(self, client):
        """POST /api/documents/{stage}/{doc_id}/versions with invalid/malformed JSON body returns 400."""
        doc_uuid = generate_uuid()
        res = client.post(
            f"/api/documents/catalog/{doc_uuid}/versions",
            content="not a JSON string",
            headers={"Content-Type": "application/json"}
        )
        assert res.status_code == 400
        assert "invalid json body" in res.json()["detail"].lower()

    def test_save_version_missing_version_metadata(self, client):
        """POST /api/documents/{stage}/{doc_id}/versions with missing version key in metadata returns 400."""
        doc_uuid = generate_uuid()
        invalid_doc = {
            "catalog": {
                "uuid": doc_uuid,
                "metadata": {
                    "title": "No Version Catalog",
                    "last-modified": "2026-07-19T10:00:00Z"
                    # Missing version
                }
            }
        }
        res = client.post(f"/api/documents/catalog/{doc_uuid}/versions", json=invalid_doc)
        assert res.status_code == 400
        assert "missing version in document metadata" in res.json()["detail"].lower()

    def test_validate_document_invalid_json(self, client):
        """POST /api/validate/{stage} with invalid JSON body returns 400."""
        res = client.post(
            "/api/validate/catalog",
            content="not a JSON string",
            headers={"Content-Type": "application/json"}
        )
        assert res.status_code == 400
        assert "invalid json body" in res.json()["detail"].lower()

    def test_export_document_invalid_uuid(self, client):
        """GET /api/export/{stage}/{doc_id} with invalid UUID returns 400."""
        res = client.get("/api/export/catalog/not-a-valid-uuid")
        assert res.status_code == 400
        assert "invalid uuid format" in res.json()["detail"].lower()

    def test_export_document_not_found(self, client):
        """GET /api/export/{stage}/{doc_id} with nonexistent UUID returns 404."""
        doc_uuid = generate_uuid()
        res = client.get(f"/api/export/catalog/{doc_uuid}")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()
