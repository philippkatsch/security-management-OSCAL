"""
Integration tests for importing OSCAL documents (US 0.3).
"""
import json
import pytest
from unittest.mock import MagicMock, patch
import httpx
from fastapi.testclient import TestClient
from tests.factories import CatalogFactory, ProfileFactory

class TestImportRoutesIntegration:

    @patch("app.services.import_service.httpx.AsyncClient")
    def test_us0_3_import_registry_success(self, mock_client_class, client, isolated_data_dir):
        """Verify that importing a valid catalog from the registry successfully saves it."""
        from unittest.mock import AsyncMock
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        # Build a valid catalog document using factory
        catalog_doc = CatalogFactory.build(
            title="Imported Registry Catalog",
            version="1.0.0"
        )
        mock_uuid = catalog_doc["catalog"]["uuid"]
        mock_response.json.return_value = catalog_doc
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        # Call registry import endpoint
        response = client.post("/api/import/registry/nist-800-53-rev5-catalog")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["uuid"] == mock_uuid
        assert data["stage"] == "catalogs"
        assert data["title"] == "Imported Registry Catalog"

        # Verify that the document can be fetched via API
        fetch_res = client.get(f"/api/documents/catalogs/{mock_uuid}")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["catalog"]["metadata"]["title"] == "Imported Registry Catalog"

    @patch("app.services.import_service.httpx.AsyncClient")
    def test_us0_3_import_url_success_and_validate_schema(self, mock_client_class, client, isolated_data_dir):
        """Verify importing from a custom URL with schema validation flag."""
        from unittest.mock import AsyncMock
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        # Build a catalog document using factory
        catalog_doc = CatalogFactory.build(
            title="Imported URL Catalog",
            version="2.0.0"
        )
        mock_uuid = catalog_doc["catalog"]["uuid"]
        mock_response.json.return_value = catalog_doc
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        # Import URL with validation_schema = True
        payload = {
            "url": "https://example.com/some-catalog.json",
            "validate_schema": True
        }
        response = client.post("/api/import/url", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["uuid"] == mock_uuid
        assert data["stage"] == "catalogs"

        # Verify it is stored
        fetch_res = client.get(f"/api/documents/catalogs/{mock_uuid}")
        assert fetch_res.status_code == 200

        # Test validation bypass: build an invalid document
        invalid_doc = {
            "catalog": {
                "uuid": mock_uuid,
                "metadata": {
                    # Missing title, version, etc. causing schema violation
                }
            }
        }
        mock_response.json.return_value = invalid_doc
        
        # With validation = True, it should fail
        response = client.post("/api/import/url", json={"url": "https://example.com/invalid.json", "validate_schema": True})
        assert response.status_code == 422
        
        # With validation = False, it should skip validation and save successfully
        response = client.post("/api/import/url", json={"url": "https://example.com/invalid.json", "validate_schema": False})
        assert response.status_code == 200
        assert response.json()["status"] == "updated"

    def test_us0_3_import_file_json(self, client, isolated_data_dir):
        """Verify importing a valid JSON file."""
        catalog_doc = CatalogFactory.build(title="JSON Imported File")
        catalog_uuid = catalog_doc["catalog"]["uuid"]
        
        files = {
            "file": ("catalog.json", json.dumps(catalog_doc), "application/json")
        }
        response = client.post("/api/import/file", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["uuid"] == catalog_uuid
        assert data["stage"] == "catalogs"

        # Verify it exists
        fetch_res = client.get(f"/api/documents/catalogs/{catalog_uuid}")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["catalog"]["metadata"]["title"] == "JSON Imported File"

    def test_us0_3_import_file_yaml(self, client, isolated_data_dir):
        """Verify importing a valid YAML file."""
        import yaml
        catalog_doc = CatalogFactory.build(title="YAML Imported File")
        catalog_uuid = catalog_doc["catalog"]["uuid"]
        yaml_content = yaml.dump(catalog_doc)

        files = {
            "file": ("catalog.yaml", yaml_content, "application/x-yaml")
        }
        response = client.post("/api/import/file", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["uuid"] == catalog_uuid
        assert data["stage"] == "catalogs"

        # Verify storage
        fetch_res = client.get(f"/api/documents/catalogs/{catalog_uuid}")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["catalog"]["metadata"]["title"] == "YAML Imported File"

    def test_us0_3_import_file_xml(self, client, isolated_data_dir):
        """Verify importing a valid XML file."""
        from app.format_converter import serialize_oscal_dict_to_xml
        
        # Build catalog
        catalog_doc = CatalogFactory.build(title="XML Imported File")
        catalog_uuid = catalog_doc["catalog"]["uuid"]
        xml_content = serialize_oscal_dict_to_xml(catalog_doc)

        files = {
            "file": ("catalog.xml", xml_content, "application/xml")
        }
        response = client.post("/api/import/file", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["uuid"] == catalog_uuid
        assert data["stage"] == "catalogs"

        # Verify storage
        fetch_res = client.get(f"/api/documents/catalogs/{catalog_uuid}")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["catalog"]["metadata"]["title"] == "XML Imported File"

    def test_us0_3_import_file_invalid_parse(self, client):
        """Verify uploading invalid file structure or malformed data results in an error."""
        # Malformed JSON
        files = {
            "file": ("malformed.json", "not a json string at all {", "application/json")
        }
        response = client.post("/api/import/file", files=files)
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Failed to parse" in detail or "Invalid OSCAL document structure" in detail

        # Valid JSON but not a dictionary (must be object)
        files = {
            "file": ("list.json", "[1, 2, 3]", "application/json")
        }
        response = client.post("/api/import/file", files=files)
        assert response.status_code == 400
        assert "Invalid OSCAL document structure" in response.json()["detail"]

    @patch("app.services.import_service.httpx.AsyncClient")
    def test_import_registry_non_persisting(self, mock_client_class, client, isolated_data_dir):
        """Verify importing with persist=false parses and returns document without writing to disk."""
        from unittest.mock import AsyncMock
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200

        catalog_doc = CatalogFactory.build(
            title="Registry Parse-Only Catalog",
            version="1.0.0"
        )
        mock_uuid = catalog_doc["catalog"]["uuid"]
        mock_response.json.return_value = catalog_doc
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        response = client.post("/api/import/registry/nist-800-53-rev5-catalog?persist=false")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parsed"
        assert data["uuid"] == mock_uuid
        assert data["stage"] == "catalogs"
        assert data["title"] == "Registry Parse-Only Catalog"
        assert "document" in data
        assert data["document"]["catalog"]["uuid"] == mock_uuid

        # Verify it was NOT saved to disk
        fetch_res = client.get(f"/api/documents/catalogs/{mock_uuid}")
        assert fetch_res.status_code == 404

    @patch("app.services.import_service.httpx.AsyncClient")
    def test_import_url_non_persisting(self, mock_client_class, client, isolated_data_dir):
        """Verify URL import with persist=false does not persist to disk."""
        from unittest.mock import AsyncMock
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 200

        catalog_doc = CatalogFactory.build(
            title="URL Parse-Only Catalog",
            version="1.0.0"
        )
        mock_uuid = catalog_doc["catalog"]["uuid"]
        mock_response.json.return_value = catalog_doc
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        # Test both query param and body payload persist: false
        payload = {
            "url": "https://example.com/some-catalog.json",
            "persist": False
        }
        response = client.post("/api/import/url", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parsed"
        assert data["uuid"] == mock_uuid
        assert "document" in data

        # Verify not persisted
        fetch_res = client.get(f"/api/documents/catalogs/{mock_uuid}")
        assert fetch_res.status_code == 404

    def test_import_file_non_persisting(self, client, isolated_data_dir):
        """Verify file import with persist=false returns parsed document without saving to disk."""
        catalog_doc = CatalogFactory.build(title="File Parse-Only Catalog")
        catalog_uuid = catalog_doc["catalog"]["uuid"]

        files = {
            "file": ("catalog.json", json.dumps(catalog_doc), "application/json")
        }
        response = client.post("/api/import/file?persist=false", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parsed"
        assert data["uuid"] == catalog_uuid
        assert "document" in data

        # Verify not persisted
        fetch_res = client.get(f"/api/documents/catalogs/{catalog_uuid}")
        assert fetch_res.status_code == 404

    def test_import_parse_endpoint(self, client, isolated_data_dir):
        """Verify POST /api/import/parse endpoint parses document directly."""
        catalog_doc = CatalogFactory.build(title="Direct Parse Catalog")
        catalog_uuid = catalog_doc["catalog"]["uuid"]

        # Parse from JSON dictionary
        response = client.post("/api/import/parse", json={"document": catalog_doc})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parsed"
        assert data["uuid"] == catalog_uuid
        assert "document" in data

        # Verify not persisted
        fetch_res = client.get(f"/api/documents/catalogs/{catalog_uuid}")
        assert fetch_res.status_code == 404

        # Parse from raw text
        response = client.post("/api/import/parse", json={"raw_text": json.dumps(catalog_doc)})
        assert response.status_code == 200
        assert response.json()["status"] == "parsed"

        # Missing input
        response = client.post("/api/import/parse", json={})
        assert response.status_code == 400

    def test_import_file_with_unspecified_filename(self, client, isolated_data_dir):
        """Verify uploading file without explicit extension defaults to JSON/YAML parsing cleanly."""
        catalog_doc = CatalogFactory.build(title="No Extension Catalog")
        files = {
            "file": ("catalog", json.dumps(catalog_doc), "application/json")
        }
        response = client.post("/api/import/file?persist=false", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parsed"
        assert data["title"] == "No Extension Catalog"

    def test_import_parse_schema_validation_error(self, client, isolated_data_dir):
        """Verify /api/import/parse returns 422 on schema violation when validate_schema is True."""
        invalid_doc = {
            "catalog": {
                "uuid": "00000000-0000-4000-8000-000000000001",
                "metadata": {}  # Missing title, version, etc.
            }
        }
        response = client.post("/api/import/parse", json={"document": invalid_doc, "validate_schema": True})
        assert response.status_code == 422
        assert "Schema validation failed" in response.json()["detail"]
