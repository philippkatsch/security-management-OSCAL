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


class TestProfilePartAdditions:
    """Concrete tests for statement part additions at all OSCAL positional directives."""

    def test_resolve_add_part_starting_root(self, client, isolated_data_dir):
        """Verify part addition at position 'starting' at control parts root."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control Policy",
                "parts": [
                    {"id": "ac-1_smt", "name": "statement", "prose": "Base policy statement."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "starting",
                        "parts": [
                            {
                                "id": "ac-1_header",
                                "name": "header",
                                "prose": "Organization Prefix."
                            }
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        parts = ctrl.get("parts", [])
        assert len(parts) == 2
        assert parts[0]["id"] == "ac-1_header"
        assert parts[0]["prose"] == "Organization Prefix."
        assert parts[1]["id"] == "ac-1_smt"

    def test_resolve_add_part_ending_root(self, client, isolated_data_dir):
        """Verify part addition at position 'ending' at control parts root."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control Policy",
                "parts": [
                    {"id": "ac-1_smt", "name": "statement", "prose": "Base statement."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "ending",
                        "parts": [
                            {
                                "id": "ac-1_gdn",
                                "name": "guidance",
                                "prose": "Supplemental guidance."
                            }
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        parts = ctrl.get("parts", [])
        assert len(parts) == 2
        assert parts[0]["id"] == "ac-1_smt"
        assert parts[1]["id"] == "ac-1_gdn"

    def test_resolve_add_part_before_by_id(self, client, isolated_data_dir):
        """Verify part addition at position 'before' targeting a specific sibling part by-id."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "p-1", "name": "item", "prose": "First requirement."},
                    {"id": "p-3", "name": "item", "prose": "Third requirement."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "before",
                        "by-id": "p-3",
                        "parts": [
                            {"id": "p-2", "name": "item", "prose": "Second requirement (inserted before p-3)."}
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        parts = res.json()["controls"][0].get("parts", [])
        assert [p["id"] for p in parts] == ["p-1", "p-2", "p-3"]

    def test_resolve_add_part_after_by_id(self, client, isolated_data_dir):
        """Verify part addition at position 'after' targeting a specific sibling part by-id."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "p-1", "name": "item", "prose": "First."},
                    {"id": "p-3", "name": "item", "prose": "Third."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "after",
                        "by-id": "p-1",
                        "parts": [
                            {"id": "p-2", "name": "item", "prose": "Second (inserted after p-1)."}
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        parts = res.json()["controls"][0].get("parts", [])
        assert [p["id"] for p in parts] == ["p-1", "p-2", "p-3"]


class TestProfilePartRemovals:
    """Concrete tests for statement part removals by various OSCAL match criteria."""

    def test_resolve_remove_part_by_id_recursive(self, client, isolated_data_dir):
        """Verify removal of a nested sub-clause by ID while leaving sibling parts intact."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control Policy",
                "parts": [
                    {
                        "id": "ac-1_smt",
                        "name": "statement",
                        "prose": "The organization:",
                        "parts": [
                            {"id": "ac-1_smt.a", "name": "item", "prose": "Develops policy."},
                            {"id": "ac-1_smt.b", "name": "item", "prose": "Reviews policy quarterly."},
                            {"id": "ac-1_smt.c", "name": "item", "prose": "Disseminates policy."}
                        ]
                    }
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "removes": [
                    {"by-id": "ac-1_smt.b"}
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        smt_parts = ctrl["parts"][0]["parts"]
        assert len(smt_parts) == 2
        assert [p["id"] for p in smt_parts] == ["ac-1_smt.a", "ac-1_smt.c"]

    def test_resolve_remove_part_by_name_recursive(self, client, isolated_data_dir):
        """Verify recursive removal of all parts matching by-name (e.g. stripping all guidance)."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "ac-1_smt", "name": "statement", "prose": "Policy requirements."},
                    {"id": "ac-1_gdn", "name": "guidance", "prose": "Top level guidance."},
                    {
                        "id": "ac-1_obj",
                        "name": "objective",
                        "parts": [
                            {"id": "ac-1_obj_gdn", "name": "guidance", "prose": "Nested objective guidance."}
                        ]
                    }
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "removes": [
                    {"by-name": "guidance"}
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]

        # Verify top-level guidance removed
        part_names = [p["name"] for p in ctrl["parts"]]
        assert "guidance" not in part_names
        assert len(ctrl["parts"]) == 2

        # Verify nested guidance removed inside objective
        obj_part = next(p for p in ctrl["parts"] if p["name"] == "objective")
        nested_names = [p["name"] for p in obj_part.get("parts", [])]
        assert "guidance" not in nested_names

    def test_resolve_remove_part_by_ns(self, client, isolated_data_dir):
        """Verify removal of parts tagged with a specific namespace."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "p-std", "name": "statement", "prose": "Standard part."},
                    {"id": "p-legacy", "name": "statement", "ns": "https://legacy.vendor.org/ns", "prose": "Vendor legacy part."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "removes": [
                    {"by-ns": "https://legacy.vendor.org/ns"}
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        parts = res.json()["controls"][0].get("parts", [])
        assert len(parts) == 1
        assert parts[0]["id"] == "p-std"

    def test_resolve_remove_conjunction_matching(self, client, isolated_data_dir):
        """Verify that when multiple criteria (e.g. by-id AND by-name) are given, removal occurs ONLY when ALL match."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "part-x", "name": "statement", "prose": "Must NOT be removed if name doesn't match."},
                    {"id": "part-y", "name": "item", "prose": "Must be removed because both id and name match."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "removes": [
                    {"by-id": "part-x", "by-name": "guidance"},
                    {"by-id": "part-y", "by-name": "item"}
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        parts = res.json()["controls"][0].get("parts", [])
        assert len(parts) == 1
        assert parts[0]["id"] == "part-x"


class TestProfileDeepNestedStatementAlters:
    """Concrete tests for multi-level nested statement alterations and in-place replacement."""

    def test_resolve_3_level_nested_statement_addition_and_removal(self, client, isolated_data_dir):
        """Verify deep 3-level tree mutation (Statement -> Item -> Sub-item)."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ia-2",
                "title": "Identification and Authentication",
                "parts": [
                    {
                        "id": "ia-2_smt",
                        "name": "statement",
                        "prose": "The information system:",
                        "parts": [
                            {
                                "id": "ia-2_smt.1",
                                "name": "item",
                                "prose": "Uniquely identifies and authenticates organizational users:",
                                "parts": [
                                    {"id": "ia-2_smt.1.a", "name": "item", "prose": "Using passwords."},
                                    {"id": "ia-2_smt.1.b", "name": "item", "prose": "Using smart cards."}
                                ]
                            }
                        ]
                    }
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ia-2",
                "removes": [
                    {"by-id": "ia-2_smt.1.a"}
                ],
                "adds": [
                    {
                        "position": "after",
                        "by-id": "ia-2_smt.1.b",
                        "parts": [
                            {"id": "ia-2_smt.1.c", "name": "item", "prose": "Using hardware FIDO2 tokens."}
                        ]
                    },
                    {
                        "position": "ending",
                        "by-id": "ia-2_smt",
                        "parts": [
                            {
                                "id": "ia-2_smt.2",
                                "name": "item",
                                "prose": "Authenticates service accounts using mutual TLS."
                            }
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]

        # Verify level 1 statement parts
        smt = ctrl["parts"][0]
        assert len(smt["parts"]) == 2
        assert smt["parts"][0]["id"] == "ia-2_smt.1"
        assert smt["parts"][1]["id"] == "ia-2_smt.2"
        assert smt["parts"][1]["prose"] == "Authenticates service accounts using mutual TLS."

        # Verify level 2 item parts inside ia-2_smt.1
        sub_items = smt["parts"][0]["parts"]
        assert len(sub_items) == 2
        assert [p["id"] for p in sub_items] == ["ia-2_smt.1.b", "ia-2_smt.1.c"]
        assert sub_items[1]["prose"] == "Using hardware FIDO2 tokens."

    def test_resolve_statement_replacement_pattern(self, client, isolated_data_dir):
        """Verify standard UI replacement pattern: remove original part + add modified part at 'after'."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "p-1", "name": "item", "prose": "Original prose 1."},
                    {"id": "p-2", "name": "item", "prose": "Original prose 2."},
                    {"id": "p-3", "name": "item", "prose": "Original prose 3."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "removes": [{"by-id": "p-2"}],
                "adds": [
                    {
                        "position": "after",
                        "by-id": "p-2",
                        "parts": [
                            {"id": "p-2_modified", "name": "item", "prose": "Updated modified prose 2."}
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        parts = res.json()["controls"][0].get("parts", [])
        assert len(parts) == 3
        assert [p["id"] for p in parts] == ["p-1", "p-2_modified", "p-3"]
        assert parts[1]["prose"] == "Updated modified prose 2."

    def test_resolve_title_and_id_override_props(self, client, isolated_data_dir):
        """Verify title-override and id-override props update control title and ID."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Original Title",
                "parts": [{"id": "p-1", "name": "statement", "prose": "Prose."}]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "ending",
                        "props": [
                            {"name": "title-override", "value": "Tailored Policy Title"},
                            {"name": "id-override", "value": "custom-ac-1"}
                        ]
                    }
                ]
            }
        ]

        prof_doc = ProfileFactory.with_alters(catalog_uuid=cat_uuid, alters=alters)
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 1
        ctrl = data["controls"][0]
        assert ctrl["title"] == "Tailored Policy Title"
        assert ctrl["id"] == "custom-ac-1"
        assert ctrl["originalId"] == "ac-1"


class TestChainedProfileResolutionAlters:
    """Concrete tests for multi-tier profile-of-profile cascading resolution with alters & param overrides."""

    def test_chained_profile_cumulative_alters_and_params(self, client, isolated_data_dir):
        """
        Scenario:
        Catalog (ac-1 with ac-1_smt.a, ac-1_smt.b; params prm_1=def1, prm_2=def2)
          ▲
        Profile A (imports Catalog)
          - Overrides prm_1 -> 'valA_1'
          - Adds part ac-1_smt.c (ending inside ac-1_smt)
          ▲
        Profile B (imports Profile A)
          - Overrides prm_2 -> 'valB_2'
          - Removes part ac-1_smt.a
          - Adds part ac-1_smt.d (after ac-1_smt.c)
        """
        # 1. Base Catalog
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "params": [
                    {"id": "prm_1", "values": ["def1"]},
                    {"id": "prm_2", "values": ["def2"]}
                ],
                "parts": [
                    {
                        "id": "ac-1_smt",
                        "name": "statement",
                        "prose": "Statement root:",
                        "parts": [
                            {"id": "ac-1_smt.a", "name": "item", "prose": "Clause A"},
                            {"id": "ac-1_smt.b", "name": "item", "prose": "Clause B"}
                        ]
                    }
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Profile A (Tier 1)
        prof_a_doc = ProfileFactory.build(
            title="Tier 1 Profile A",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [{"param-id": "prm_1", "values": ["valA_1"]}],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {
                                "position": "ending",
                                "by-id": "ac-1_smt",
                                "parts": [{"id": "ac-1_smt.c", "name": "item", "prose": "Clause C (from Profile A)"}]
                            }
                        ]
                    }
                ]
            }
        )
        prof_a_uuid = prof_a_doc["profile"]["uuid"]
        res_a = client.post("/api/documents/profiles", json=prof_a_doc)
        assert res_a.status_code == 201

        # 3. Profile B (Tier 2 - importing Profile A)
        prof_b_doc = ProfileFactory.build(
            title="Tier 2 Profile B",
            imports=[{"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [{"param-id": "prm_2", "values": ["valB_2"]}],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "removes": [{"by-id": "ac-1_smt.a"}],
                        "adds": [
                            {
                                "position": "after",
                                "by-id": "ac-1_smt.c",
                                "parts": [{"id": "ac-1_smt.d", "name": "item", "prose": "Clause D (from Profile B)"}]
                            }
                        ]
                    }
                ]
            }
        )
        prof_b_uuid = prof_b_doc["profile"]["uuid"]
        res_b = client.post("/api/documents/profiles", json=prof_b_doc)
        assert res_b.status_code == 201

        # 4. Resolve Profile B
        res = client.get(f"/api/resolve/profile/{prof_b_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["controls"]) == 1
        ctrl = data["controls"][0]

        # Verify parameter overrides
        param_map = {p["id"]: p.get("values") for p in ctrl.get("params", [])}
        assert param_map.get("prm_1") == ["valA_1"]
        assert param_map.get("prm_2") == ["valB_2"]

        # Verify statement sub-parts:
        # ac-1_smt.a was removed by Profile B
        # ac-1_smt.b remained from Catalog
        # ac-1_smt.c was added by Profile A
        # ac-1_smt.d was added by Profile B after ac-1_smt.c
        subparts = ctrl["parts"][0]["parts"]
        subpart_ids = [p["id"] for p in subparts]
        assert subpart_ids == ["ac-1_smt.b", "ac-1_smt.c", "ac-1_smt.d"]

    def test_chained_profile_downstream_override_priority(self, client, isolated_data_dir):
        """Verify downstream profile can override an alter/param set by upstream profile."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "params": [{"id": "prm_1", "values": ["base_val"]}],
                "parts": [{"id": "p-1", "name": "item", "prose": "Base."}]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile A overrides prm_1 to 'val_A' and adds temporary part 'p-temp'
        prof_a_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [{"param-id": "prm_1", "values": ["val_A"]}],
                "alters": [
                    {"control-id": "ac-1", "adds": [{"position": "ending", "parts": [{"id": "p-temp", "name": "item", "prose": "Temp."}]}]}
                ]
            }
        )
        prof_a_uuid = prof_a_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_a_doc)

        # Profile B overrides prm_1 to 'val_B' and removes 'p-temp'
        prof_b_doc = ProfileFactory.build(
            imports=[{"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [{"param-id": "prm_1", "values": ["val_B"]}],
                "alters": [
                    {"control-id": "ac-1", "removes": [{"by-id": "p-temp"}]}
                ]
            }
        )
        prof_b_uuid = prof_b_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_b_doc)

        res = client.get(f"/api/resolve/profile/{prof_b_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        assert ctrl["params"][0]["values"] == ["val_B"]
        assert [p["id"] for p in ctrl["parts"]] == ["p-1"]

