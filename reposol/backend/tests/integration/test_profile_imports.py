"""
Integration tests for Profile imports (US 2.2, 2.14).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileImports:
    """Tests for Profile imports of catalogs and profiles."""

    def test_import_single_catalog(self, client, isolated_data_dir):
        # Create and save a base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # Create a profile importing that catalog
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Imports Catalog Profile")
        prof_uuid = prof_doc["profile"]["uuid"]
        
        # Save the profile
        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201
        
        # Get and verify imports
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        imports = get_data["profile"]["imports"]
        assert len(imports) == 1
        assert imports[0]["href"] == f"../catalogs/{cat_uuid}.json"
        assert "include-all" in imports[0]

    def test_import_multiple_catalogs(self, client, isolated_data_dir):
        # Create and save two base catalogs
        cat1_doc = CatalogFactory.build(title="Catalog 1")
        cat1_uuid = cat1_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat1_doc)

        cat2_doc = CatalogFactory.build(title="Catalog 2")
        cat2_uuid = cat2_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat2_doc)

        # Create a profile that imports both
        prof_doc = ProfileFactory.build(
            title="Imports Multiple Catalogs Profile",
            imports=[
                {"href": f"../catalogs/{cat1_uuid}.json", "include-all": {}},
                {"href": f"../catalogs/{cat2_uuid}.json", "include-all": {}}
            ]
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201

        # Get and verify both imports are present
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        imports = get_data["profile"]["imports"]
        assert len(imports) == 2
        hrefs = [imp["href"] for imp in imports]
        assert f"../catalogs/{cat1_uuid}.json" in hrefs
        assert f"../catalogs/{cat2_uuid}.json" in hrefs

    def test_import_cascaded_profiles(self, client, isolated_data_dir):
        # Create and save a base catalog
        cat_doc = CatalogFactory.build(title="Base Catalog")
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Create and save Profile A importing the catalog
        prof_a_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Profile A")
        prof_a_uuid = prof_a_doc["profile"]["uuid"]
        res_a = client.post("/api/documents/profiles", json=prof_a_doc)
        assert res_a.status_code == 201

        # Create Profile B importing Profile A
        prof_b_doc = ProfileFactory.build(
            title="Profile B (Cascaded)",
            imports=[
                {"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}
            ]
        )
        prof_b_uuid = prof_b_doc["profile"]["uuid"]
        res_b = client.post("/api/documents/profiles", json=prof_b_doc)
        assert res_b.status_code == 201

        # Get Profile B and verify it imports Profile A
        res_get = client.get(f"/api/documents/profiles/{prof_b_uuid}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        
        imports = get_data["profile"]["imports"]
        assert len(imports) == 1
        assert imports[0]["href"] == f"../profiles/{prof_a_uuid}.json"
