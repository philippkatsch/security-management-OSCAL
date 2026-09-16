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

    def test_stage3_known_sources_registry_resolution(self, client, isolated_data_dir):
        """Verify that Stage 3 component definitions in KNOWN_SOURCES resolve is_imported correctly."""
        res = client.get("/api/import/registry")
        assert res.status_code == 200
        sources = res.json()
        cdef_sources = [s for s in sources if s.get("model") == "component-definition"]
        assert len(cdef_sources) >= 3
        
        # Verify specific expected IDs
        source_ids = {s["id"] for s in cdef_sources}
        assert "bsi-keycloak-component-definition" in source_ids
        assert "bsi-aws-security-hub-component-definition" in source_ids
        assert "nist-example-component-definition" in source_ids
        
        # Initially not imported in isolated test dir
        aws_source = next(s for s in cdef_sources if s["id"] == "bsi-aws-security-hub-component-definition")
        assert aws_source["uuid"] == "354a88d1-e935-4399-851e-263e7b3d4796"
        assert aws_source["is_imported"] is False

        # Create document with that UUID in component-definitions stage
        sample_cdef = {
            "component-definition": {
                "uuid": aws_source["uuid"],
                "metadata": {
                    "title": "AWS Security Hub Mock",
                    "version": "1.0.0",
                    "oscal-version": "1.2.2",
                    "last-modified": "2026-09-12T00:00:00Z"
                },
                "components": []
            }
        }
        create_res = client.post("/api/documents/component-definitions", json=sample_cdef)
        assert create_res.status_code in (200, 201)

        # Now verify that is_imported is True and workspace_version is returned
        res2 = client.get("/api/import/registry")
        assert res2.status_code == 200
        aws_source_updated = next(s for s in res2.json() if s["id"] == "bsi-aws-security-hub-component-definition")
        assert aws_source_updated["is_imported"] is True
        assert aws_source_updated.get("workspace_version") == "1.0.0"

    def test_import_already_exists_identical(self, client, isolated_data_dir):
        """Verify that importing an identical document with same UUID returns status 'already_exists' and action 'identical'."""
        cat_doc = CatalogFactory.build(title="Identical Check Catalog", version="1.0.0")
        files = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}

        # 1. First import -> status: created
        res1 = client.post("/api/import/file", files=files)
        assert res1.status_code == 200
        assert res1.json()["status"] == "created"
        assert res1.json()["action"] == "created"

        # 2. Second import of exact same document -> status: already_exists, action: identical
        files2 = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "already_exists"
        assert data2["action"] == "identical"
        assert "already imported" in data2["message"].lower()

    def test_import_updated_version_bump(self, client, isolated_data_dir):
        """Verify that re-importing with bumped version returns status 'updated' and action 'version_bump'."""
        cat_doc = CatalogFactory.build(title="Version Bump Catalog", version="1.0.0")
        uuid = cat_doc["catalog"]["uuid"]
        files = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}

        # 1. First import
        res1 = client.post("/api/import/file", files=files)
        assert res1.status_code == 200
        assert res1.json()["status"] == "created"

        # 2. Bump version to 2.0.0 with same UUID
        cat_doc["catalog"]["metadata"]["version"] = "2.0.0"
        files2 = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "updated"
        assert data2["action"] == "version_bump"
        assert data2["version"] == "2.0.0"
        assert data2["existing_version"] == "1.0.0"

    def test_import_updated_modified_content_same_version(self, client, isolated_data_dir):
        """Verify that re-importing with modified content (e.g. controls changed) returns status 'updated' and action 'content_updated'."""
        cat_doc = CatalogFactory.build(title="Content Mod Catalog", version="1.0.0")
        files = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}

        # 1. First import
        res1 = client.post("/api/import/file", files=files)
        assert res1.status_code == 200
        assert res1.json()["status"] == "created"

        # 2. Modify description or controls
        cat_doc["catalog"]["metadata"]["remarks"] = "User modified remarks locally"
        files2 = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "updated"
        assert data2["action"] == "content_updated"

    def test_import_already_exists_with_empty_arrays(self, client, isolated_data_dir):
        """Verify that importing a document containing empty/whitespace strings returns 'already_exists' on re-import."""
        cat_doc = CatalogFactory.build(title="Empty Arrays Catalog", version="1.0.0")
        # Add whitespace remarks that validates against OSCAL schema but gets stripped by remove_empty_arrays on save
        cat_doc["catalog"]["metadata"]["remarks"] = "   "
        files = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}

        # First import
        res1 = client.post("/api/import/file", files=files)
        assert res1.status_code == 200
        assert res1.json()["status"] == "created"

        # Second import of exact same file (containing empty arrays)
        files2 = {"file": ("cat.json", json.dumps(cat_doc), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "already_exists"
        assert data2["action"] == "identical"
        assert "already imported" in data2["message"].lower()

    def test_import_duplicate_title_same_version_different_content(self, client, isolated_data_dir):
        """Verify that importing a document with matching title AND version but modified content warns about same version."""
        cat_doc1 = CatalogFactory.build(title="Company Baseline Profile", version="2.0.0")
        uuid1 = cat_doc1["catalog"]["uuid"]
        files1 = {"file": ("cat1.json", json.dumps(cat_doc1), "application/json")}
        res1 = client.post("/api/import/file", files=files1)
        assert res1.status_code == 200

        # Second document: same title, same version 2.0.0, different UUID, different content
        cat_doc2 = CatalogFactory.build(title="Company Baseline Profile", version="2.0.0")
        cat_doc2["catalog"]["metadata"]["remarks"] = "Locally modified controls baseline"
        uuid2 = cat_doc2["catalog"]["uuid"]

        files2 = {"file": ("cat2.json", json.dumps(cat_doc2), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "created"
        assert data2["action"] == "created_duplicate_title_modified"
        assert "version 2.0.0" in data2["message"]
        assert "different content/modifications" in data2["message"]

    def test_import_duplicate_title_new_uuid(self, client, isolated_data_dir):
        """Verify that importing a document with matching title but different UUID detects same_title_existing."""
        # 1. First document
        cat_doc1 = CatalogFactory.build(title="Shared Name Framework", version="1.0.0")
        uuid1 = cat_doc1["catalog"]["uuid"]
        files1 = {"file": ("cat1.json", json.dumps(cat_doc1), "application/json")}
        res1 = client.post("/api/import/file", files=files1)
        assert res1.status_code == 200
        assert res1.json()["status"] == "created"

        # 2. Second document with SAME title but DIFFERENT UUID and modified content
        cat_doc2 = CatalogFactory.build(title="Shared Name Framework", version="1.0.0")
        cat_doc2["catalog"]["metadata"]["remarks"] = "Different profile behind the scenes"
        uuid2 = cat_doc2["catalog"]["uuid"]
        assert uuid1 != uuid2

        files2 = {"file": ("cat2.json", json.dumps(cat_doc2), "application/json")}
        res2 = client.post("/api/import/file", files=files2)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "created"
        assert data2["action"] == "created_duplicate_title_modified"
        assert data2["same_title_existing"] is not None
        assert data2["same_title_existing"]["uuid"] == uuid1
        assert data2["same_title_existing"]["identical_content"] is False
        assert "different content" in data2["message"]



