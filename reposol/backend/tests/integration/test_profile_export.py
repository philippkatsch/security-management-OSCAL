"""
Integration tests for Profile export in JSON, YAML, and XML formats with Custom Groups,
Virtual UI Helper Exclusion, and NIST OSCAL Schema v1.1.2 Conformance (Milestone M4 / US 0.4).
"""
import copy
import json
import uuid
import pytest
import yaml
import xml.etree.ElementTree as ET
from tests.factories import CatalogFactory, ProfileFactory
from app.validation import validate_document


class TestProfileExport:
    """Tests for Profile export formats (JSON, YAML, XML)."""

    @pytest.mark.asyncio
    async def test_export_profile_json(self, client, isolated_data_dir):
        """Export basic profile as JSON with correct headers and schema validity."""
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/json"
        assert "Content-Disposition" in res.headers
        assert f'filename="Export_Test_Profile_{prof_uuid[:8]}.json"' in res.headers["Content-Disposition"]

        exported_data = res.json()
        assert exported_data["profile"]["uuid"] == prof_uuid
        assert exported_data["profile"]["metadata"]["title"] == "Export Test Profile"

        # Validate strictly against NIST OSCAL Profile Schema (raises on error)
        await validate_document("profiles", exported_data, check_refs=False)

    @pytest.mark.asyncio
    async def test_export_profile_yaml(self, client, isolated_data_dir):
        """Export basic profile as YAML with correct headers and structure."""
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res.status_code == 200
        assert "yaml" in res.headers["content-type"]
        assert "Content-Disposition" in res.headers
        assert f'filename="Export_Test_Profile_{prof_uuid[:8]}.yaml"' in res.headers["Content-Disposition"]

        exported_yaml = yaml.safe_load(res.text)
        assert exported_yaml["profile"]["uuid"] == prof_uuid
        assert exported_yaml["profile"]["metadata"]["title"] == "Export Test Profile"

        # Schema validate exported YAML data
        await validate_document("profiles", exported_yaml, check_refs=False)

    def test_export_profile_xml(self, client, isolated_data_dir):
        """Export basic profile as XML with correct headers and XML tag hierarchy."""
        cat_doc = CatalogFactory.build()
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Export Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res.status_code == 200
        assert "xml" in res.headers["content-type"]
        assert "Content-Disposition" in res.headers
        assert f'filename="Export_Test_Profile_{prof_uuid[:8]}.xml"' in res.headers["Content-Disposition"]

        root = ET.fromstring(res.text)
        assert "profile" in root.tag

    def test_export_profile_not_found(self, client, isolated_data_dir):
        """Requesting export for nonexistent profile returns 404."""
        fake_uuid = str(uuid.uuid4())
        res = client.get(f"/api/export/profiles/{fake_uuid}?format=json")
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_export_profile_with_custom_groups_json(self, client, isolated_data_dir):
        """Export profile containing custom merge hierarchy and verify schema compliance."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management"},
                {"id": "ia-2", "title": "Identification and Authentication"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Custom Groups Export Profile")
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-core-security",
                        "title": "Core Security Requirements",
                        "class": "family",
                        "insert-controls": [
                            {
                                "order": "ascending",
                                "include-controls": [{"with-ids": ["ac-1", "ac-2"]}],
                            }
                        ],
                        "groups": [
                            {
                                "id": "subgrp-auth",
                                "title": "Authentication Sub-group",
                                "class": "subfamily",
                                "insert-controls": [
                                    {
                                        "order": "ascending",
                                        "include-controls": [{"with-ids": ["ia-2"]}],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        res_export = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_export.status_code == 200
        exported = res_export.json()

        # Check structure preservation
        custom = exported["profile"]["merge"]["custom"]
        assert len(custom["groups"]) == 1
        root_grp = custom["groups"][0]
        assert root_grp["id"] == "grp-core-security"
        assert root_grp["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ac-1", "ac-2"]
        assert len(root_grp["groups"]) == 1
        sub_grp = root_grp["groups"][0]
        assert sub_grp["id"] == "subgrp-auth"
        assert sub_grp["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ia-2"]

        # Validate strictly against NIST OSCAL Profile Schema
        await validate_document("profiles", exported, check_refs=False)

    @pytest.mark.asyncio
    async def test_export_profile_with_custom_groups_yaml_and_xml(self, client, isolated_data_dir):
        """Export custom groups profile in YAML and XML formats and verify round-trip integrity."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ia-2", "title": "Identification and Authentication"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Multi-Format Export Profile")
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-1",
                        "title": "Access Group",
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["ac-1"]}]}
                        ],
                    },
                    {
                        "id": "grp-2",
                        "title": "Auth Group",
                        "insert-controls": [
                            {"order": "descending", "include-controls": [{"with-ids": ["ia-2"]}]}
                        ],
                    },
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        # YAML Export
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        parsed_yaml = yaml.safe_load(res_yaml.text)
        assert len(parsed_yaml["profile"]["merge"]["custom"]["groups"]) == 2
        await validate_document("profiles", parsed_yaml, check_refs=False)

        # XML Export
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        root = ET.fromstring(res_xml.text)
        assert "profile" in root.tag

    @pytest.mark.asyncio
    async def test_export_profile_excludes_virtual_ui_helpers(self, client, isolated_data_dir):
        """Exported documents must strictly exclude virtual UI helpers like __unassigned__ and virtual-unassigned."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "au-1", "title": "Audit Policy"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Sanitization Export Profile")
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-ac",
                        "title": "Access Controls",
                        "insert-controls": [
                            {"order": "keep", "include-controls": [{"with-ids": ["ac-1"]}]}
                        ],
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        # Check JSON export
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        exported_json = res_json.json()
        groups = exported_json["profile"]["merge"]["custom"]["groups"]
        group_ids = [g.get("id") for g in groups]
        group_classes = [g.get("class") for g in groups]

        assert "__unassigned__" not in group_ids
        assert "virtual-unassigned" not in group_classes
        assert len(groups) == 1
        assert groups[0]["id"] == "grp-ac"

        # Check raw JSON string for absence
        assert "__unassigned__" not in res_json.text
        assert "virtual-unassigned" not in res_json.text

        # Check YAML export
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        assert "__unassigned__" not in res_yaml.text
        assert "virtual-unassigned" not in res_yaml.text

        # Check XML export
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        assert "__unassigned__" not in res_xml.text
        assert "virtual-unassigned" not in res_xml.text

        # Schema validate
        await validate_document("profiles", exported_json, check_refs=False)

    @pytest.mark.asyncio
    async def test_export_profile_sanitizes_empty_arrays_min_items_1(self, client, isolated_data_dir):
        """Exported documents must sanitize empty groups and insert-controls arrays to satisfy minItems: 1."""
        cat_doc = CatalogFactory.build(controls=[{"id": "ac-1", "title": "Access Control Policy"}])
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Empty Array Sanitization Profile")
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-with-empty-children",
                        "title": "Group with Empty Child Arrays",
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["ac-1"]}]}
                        ],
                        # Empty sub-groups array
                        "groups": [],
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        res_export = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_export.status_code == 200
        exported = res_export.json()

        root_grp = exported["profile"]["merge"]["custom"]["groups"][0]
        # Empty groups array must be stripped
        assert "groups" not in root_grp or len(root_grp["groups"]) > 0

        # Validate strictly against NIST OSCAL Profile Schema
        await validate_document("profiles", exported, check_refs=False)
