"""
Integration tests for Profile export in JSON, YAML, and XML formats (US 0.4).
"""
import json
import pytest
import yaml
import xml.etree.ElementTree as ET
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileExport:
    """Tests for Profile export formats (JSON, YAML, XML)."""

    def test_export_profile_json(self, client, isolated_data_dir):
        # Create base catalog
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create profile
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # Export in JSON format
        res = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/json"
        assert "Content-Disposition" in res.headers
        assert f"filename=\"Export_Test_Profile_{prof_uuid[:8]}.json\"" in res.headers["Content-Disposition"]

        # Parse response body
        exported_data = res.json()
        assert exported_data["profile"]["uuid"] == prof_uuid
        assert exported_data["profile"]["metadata"]["title"] == "Export Test Profile"

    def test_export_profile_yaml(self, client, isolated_data_dir):
        # Create base catalog
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create profile
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # Export in YAML format
        res = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res.status_code == 200
        assert "yaml" in res.headers["content-type"]
        assert "Content-Disposition" in res.headers
        assert f"filename=\"Export_Test_Profile_{prof_uuid[:8]}.yaml\"" in res.headers["Content-Disposition"]

        # Parse response body as YAML
        exported_yaml = yaml.safe_load(res.text)
        assert exported_yaml["profile"]["uuid"] == prof_uuid
        assert exported_yaml["profile"]["metadata"]["title"] == "Export Test Profile"

    def test_export_profile_xml(self, client, isolated_data_dir):
        # Create base catalog
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create profile
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # Export in XML format
        res = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res.status_code == 200
        assert "xml" in res.headers["content-type"]
        assert "Content-Disposition" in res.headers
        assert f"filename=\"Export_Test_Profile_{prof_uuid[:8]}.xml\"" in res.headers["Content-Disposition"]

        # Parse response body as XML to ensure valid syntax
        root = ET.fromstring(res.text)
        # Check if the root element represents an OSCAL profile
        assert "profile" in root.tag

    def test_export_profile_not_found(self, client, isolated_data_dir):
        fake_uuid = str(uuid_4 := None or pytest.importorskip("uuid").uuid4())
        res = client.get(f"/api/export/profiles/{fake_uuid}?format=json")
        assert res.status_code == 404
