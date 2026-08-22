"""
Integration tests for Profile Resolution (Merge and Combine).
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestProfileResolution:
    def test_resolve_merge_flat(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build(
            controls=[],
            groups=[{
                "id": "group-1",
                "title": "Group 1",
                "controls": [
                    {"id": "c-1", "title": "Control 1"},
                    {"id": "c-2", "title": "Control 2"}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {"flat": {}}
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["groups"]) == 0
        assert len(data["controls"]) == 2
        assert {c["id"] for c in data["controls"]} == {"c-1", "c-2"}

    def test_resolve_merge_custom(self, client, isolated_data_dir):
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC-1"},
                {"id": "ac-2", "title": "AC-2"},
                {"id": "au-1", "title": "AU-1"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "custom-1",
                        "title": "My Group",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-1"]}]}
                        ]
                    }
                ],
                "insert-controls": [
                    {"include-all": {}}
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        
        # Verify custom group structure
        assert len(data["groups"]) == 1
        assert data["groups"][0]["id"] == "custom-1"
        assert len(data["groups"][0]["controls"]) == 1
        assert data["groups"][0]["controls"][0]["id"] == "ac-1"
        
        # Remaining controls at root
        assert len(data["controls"]) == 2
        assert {c["id"] for c in data["controls"]} == {"ac-2", "au-1"}

    def test_resolve_combine_use_first(self, client, isolated_data_dir):
        cat1 = CatalogFactory.build(controls=[{"id": "c-1", "title": "C-1 from Cat1"}])
        cat2 = CatalogFactory.build(controls=[{"id": "c-1", "title": "C-1 from Cat2"}])
        client.post("/api/documents/catalogs", json=cat1)
        client.post("/api/documents/catalogs", json=cat2)

        prof_doc = ProfileFactory.build(
            imports=[
                {"href": f"../catalogs/{cat1['catalog']['uuid']}.json", "include-all": {}},
                {"href": f"../catalogs/{cat2['catalog']['uuid']}.json", "include-all": {}}
            ],
            merge={"combine": {"method": "use-first"}}
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 1
        assert data["controls"][0]["title"] == "C-1 from Cat1"

    def test_resolve_combine_keep(self, client, isolated_data_dir):
        cat1 = CatalogFactory.build(controls=[{"id": "c-1", "title": "C-1 from Cat1"}])
        cat2 = CatalogFactory.build(controls=[{"id": "c-1", "title": "C-1 from Cat2"}])
        client.post("/api/documents/catalogs", json=cat1)
        client.post("/api/documents/catalogs", json=cat2)

        prof_doc = ProfileFactory.build(
            imports=[
                {"href": f"../catalogs/{cat1['catalog']['uuid']}.json", "include-all": {}},
                {"href": f"../catalogs/{cat2['catalog']['uuid']}.json", "include-all": {}}
            ],
            merge={"combine": {"method": "keep"}}
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 2

    def test_resolve_profile_of_profile(self, client, isolated_data_dir):
        cat = CatalogFactory.build(controls=[{"id": "c-1", "title": "Control"}])
        client.post("/api/documents/catalogs", json=cat)

        prof_a = ProfileFactory.importing(catalog_uuid=cat['catalog']['uuid'])
        client.post("/api/documents/profiles", json=prof_a)

        prof_b = ProfileFactory.build(
            imports=[{"href": f"../profiles/{prof_a['profile']['uuid']}.json", "include-all": {}}]
        )
        client.post("/api/documents/profiles", json=prof_b)

        res = client.get(f"/api/resolve/profile/{prof_b['profile']['uuid']}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 1
        assert data["controls"][0]["id"] == "c-1"

    def test_resolve_circular_reference(self, client, isolated_data_dir):
        import uuid
        prof_a_uuid = str(uuid.uuid4())
        prof_b_uuid = str(uuid.uuid4())

        prof_a = ProfileFactory.build()
        prof_a["profile"]["uuid"] = prof_a_uuid
        prof_a["profile"]["imports"] = [{"href": f"../profiles/{prof_b_uuid}.json", "include-all": {}}]
        
        prof_b = ProfileFactory.build()
        prof_b["profile"]["uuid"] = prof_b_uuid
        prof_b["profile"]["imports"] = [{"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}]

        client.post("/api/documents/profiles", json=prof_a)
        client.post("/api/documents/profiles", json=prof_b)

        with pytest.raises(ValueError, match="Circular profile reference detected"):
            client.get(f"/api/resolve/profile/{prof_a_uuid}")
