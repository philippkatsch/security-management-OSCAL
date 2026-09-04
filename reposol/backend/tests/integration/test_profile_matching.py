"""
Integration tests for Profile pattern-based control selection matching (US 2.9).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileMatching:
    """Tests for Profile pattern matching in import rules."""

    def test_import_with_matching_patterns(self, client, isolated_data_dir):
        # Create and save base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create profile with pattern matching include-controls
        patterns = ["ac-*", "au-1*"]
        prof_doc = ProfileFactory.with_matching(
            catalog_uuid=cat_uuid,
            patterns=patterns,
            title="Profile with Pattern Matching"
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile - should succeed
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve profile and verify pattern matching
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()

        imports = get_data["profile"]["imports"]
        assert len(imports) == 1
        assert "include-controls" in imports[0]
        
        matching = imports[0]["include-controls"][0]["matching"]
        assert len(matching) == 2
        assert matching[0]["pattern"] == "ac-*"
        assert matching[1]["pattern"] == "au-1*"

    def test_import_with_exclude_patterns(self, client, isolated_data_dir):
        # Create and save base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create profile with exclude-controls pattern matching
        prof_doc = ProfileFactory.build(
            title="Profile with Exclude Patterns",
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    "include-all": {},
                    "exclude-controls": [
                        {
                            "matching": [
                                {"pattern": "ac-2*"},
                                {"pattern": "au-2*"}
                            ]
                        }
                    ]
                }
            ]
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Save profile
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Retrieve and verify exclude patterns
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()

        imports = get_data["profile"]["imports"]
        assert len(imports) == 1
        assert "exclude-controls" in imports[0]
        
        matching = imports[0]["exclude-controls"][0]["matching"]
        assert len(matching) == 2
        assert matching[0]["pattern"] == "ac-2*"
        assert matching[1]["pattern"] == "au-2*"

    def test_resolution_with_exclude_patterns(self, client, isolated_data_dir):
        # 1. Base catalog with ac-1, ac-2, ac-2.1, au-1, au-2
        cat_doc = CatalogFactory.build(
            title="Base Catalog",
            controls=[
                {"id": "ac-1", "title": "Policy"},
                {"id": "ac-2", "title": "Account Management", "controls": [{"id": "ac-2.1", "title": "Automated"}]},
                {"id": "au-1", "title": "Audit Policy"},
                {"id": "au-2", "title": "Audit Events"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Profile with exclude-controls matching glob 'ac-2*'
        prof_doc = ProfileFactory.build(
            title="Profile with Exclude Pattern Resolution",
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    "include-all": {},
                    "exclude-controls": [
                        {
                            "matching": [{"pattern": "ac-2*"}]
                        }
                    ]
                }
            ]
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # 3. Resolve profile via endpoint
        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        resolved_ctrl_ids = [c["id"].lower() for c in data["controls"]]

        assert "ac-1" in resolved_ctrl_ids
        assert "au-1" in resolved_ctrl_ids
        assert "au-2" in resolved_ctrl_ids
        assert "ac-2" not in resolved_ctrl_ids
        assert "ac-2.1" not in resolved_ctrl_ids
        assert "ac-2" in data["excluded_control_ids"]

