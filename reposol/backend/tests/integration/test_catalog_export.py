"""
Integration tests for Document Export functionality (US 0.4).
"""
import pytest
import json
import yaml
import xml.etree.ElementTree as ET
from tests.factories import CatalogFactory

class TestCatalogExport:
    def test_us0_4_export_catalog_json(self, client, saved_catalog):
        uuid, doc = saved_catalog(title="Export Test Catalog")

        # 1. Export as JSON
        res = client.get(f"/api/export/catalog/{uuid}?format=json")
        assert res.status_code == 200
        assert "application/json" in res.headers["content-type"]
        
        # Verify Content-Disposition header
        disp = res.headers["content-disposition"]
        assert "attachment" in disp
        assert f"filename=\"Export_Test_Catalog_{uuid[:8]}.json\"" in disp

        # Verify content
        exported_doc = res.json()
        assert exported_doc["catalog"]["uuid"] == uuid
        assert exported_doc["catalog"]["metadata"]["title"] == "Export Test Catalog"

    def test_us0_4_export_catalog_yaml(self, client, saved_catalog):
        uuid, doc = saved_catalog(title="Export Test Catalog")

        # 1. Export as YAML
        res = client.get(f"/api/export/catalog/{uuid}?format=yaml")
        assert res.status_code == 200
        assert "application/x-yaml" in res.headers["content-type"] or "yaml" in res.headers["content-type"]

        # Verify Content-Disposition header
        disp = res.headers["content-disposition"]
        assert "attachment" in disp
        assert f"filename=\"Export_Test_Catalog_{uuid[:8]}.yaml\"" in disp

        # Verify content parses as valid YAML
        exported_doc = yaml.safe_load(res.text)
        assert exported_doc["catalog"]["uuid"] == uuid
        assert exported_doc["catalog"]["metadata"]["title"] == "Export Test Catalog"

    def test_us0_4_export_catalog_xml(self, client, saved_catalog):
        uuid, doc = saved_catalog(title="Export Test Catalog")

        # 1. Export as XML
        res = client.get(f"/api/export/catalog/{uuid}?format=xml")
        assert res.status_code == 200
        assert "application/xml" in res.headers["content-type"] or "xml" in res.headers["content-type"]

        # Verify Content-Disposition header
        disp = res.headers["content-disposition"]
        assert "attachment" in disp
        assert f"filename=\"Export_Test_Catalog_{uuid[:8]}.xml\"" in disp

        # Verify content parses as valid XML
        root = ET.fromstring(res.text)
        assert "catalog" in root.tag
        # Check title text under metadata
        title_elem = root.find(".//{http://csrc.nist.gov/ns/oscal/1.0}title")
        assert title_elem is not None
        assert title_elem.text == "Export Test Catalog"

    def test_us0_4_export_nonexistent_returns_404(self, client):
        import uuid as uuid_module
        nonexistent_uuid = str(uuid_module.uuid4())
        res = client.get(f"/api/export/catalog/{nonexistent_uuid}?format=json")
        assert res.status_code == 404
