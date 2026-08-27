"""
Integration tests for Profile Custom Groups, Case-Insensitive Control Resolution,
Recursive Sub-Group Conflict Detection, and OSCAL v1.1.2 Schema Sanitization (M1).
"""
import copy
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory
from app.validation import validate_document
from app.services.resolution_service import (
    resolve_profile,
    resolve_profile_inline,
    detect_modify_conflicts,
    _collect_all_control_ids,
    _collect_all_param_ids,
)
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
)


class TestProfileCustomGroupResolution:
    """Tests for resolving custom group hierarchies, ordering, and case-insensitivity."""

    def test_resolve_single_custom_group_with_assigned_controls(self, client, isolated_data_dir):
        """Verify custom group partitions assigned controls from unassigned root controls."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management"},
                {"id": "au-1", "title": "Audit Policy"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "custom-ac-group",
                        "title": "Access Control Requirements",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-1", "ac-2"]}]}
                        ],
                    }
                ],
                "insert-controls": [{"include-all": {}}],
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        # Group contains ac-1 and ac-2
        assert len(data["groups"]) == 1
        custom_grp = data["groups"][0]
        assert custom_grp["id"] == "custom-ac-group"
        assert custom_grp["title"] == "Access Control Requirements"
        assert [c["id"] for c in custom_grp["controls"]] == ["ac-1", "ac-2"]

        # Root controls contain leftover au-1
        assert len(data["controls"]) == 1
        assert data["controls"][0]["id"] == "au-1"

    def test_resolve_case_insensitive_control_ids(self, client, isolated_data_dir):
        """
        Verify case-insensitivity:
        - Catalog has uppercase IDs ('AC-1', 'IA-2.1')
        - Profile has lowercase 'with-ids' ('ac-1', 'ia-2.1')
        Resolution must match and populate custom groups without KeyError.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "AC-1", "title": "Access Control Policy"},
                {"id": "IA-2.1", "title": "Multi-Factor Authentication"},
                {"id": "SC-7", "title": "Boundary Protection"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-core",
                        "title": "Core Security",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-1", "ia-2.1"]}]}
                        ],
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["groups"]) == 1
        assigned_ids = [c["id"] for c in data["groups"][0]["controls"]]
        assert assigned_ids == ["AC-1", "IA-2.1"]

    def test_resolve_nested_custom_groups_deep(self, client, isolated_data_dir):
        """Verify 3-tier deep custom group nesting (Parent -> Child -> Grandchild)."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "c-root", "title": "Root Control"},
                {"id": "c-child", "title": "Child Control"},
                {"id": "c-grandchild", "title": "Grandchild Control"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-level-1",
                        "title": "Level 1 Parent",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["c-root"]}]}
                        ],
                        "groups": [
                            {
                                "id": "grp-level-2",
                                "title": "Level 2 Child",
                                "insert-controls": [
                                    {"include-controls": [{"with-ids": ["c-child"]}]}
                                ],
                                "groups": [
                                    {
                                        "id": "grp-level-3",
                                        "title": "Level 3 Grandchild",
                                        "insert-controls": [
                                            {
                                                "include-controls": [
                                                    {"with-ids": ["c-grandchild"]}
                                                ]
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        g1 = data["groups"][0]
        assert g1["id"] == "grp-level-1"
        assert [c["id"] for c in g1["controls"]] == ["c-root"]

        g2 = g1["groups"][0]
        assert g2["id"] == "grp-level-2"
        assert [c["id"] for c in g2["controls"]] == ["c-child"]

        g3 = g2["groups"][0]
        assert g3["id"] == "grp-level-3"
        assert [c["id"] for c in g3["controls"]] == ["c-grandchild"]

    def test_resolve_custom_group_order_directives(self, client, isolated_data_dir):
        """Verify ordering directives inside custom groups (ascending vs descending)."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-10", "title": "Session Termination"},
                {"id": "ac-02", "title": "Account Management"},
                {"id": "ac-05", "title": "Separation of Duties"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-asc",
                        "title": "Ascending Group",
                        "insert-controls": [
                            {
                                "order": "ascending",
                                "include-controls": [
                                    {"with-ids": ["ac-10", "ac-02", "ac-05"]}
                                ],
                            }
                        ],
                    },
                    {
                        "id": "grp-desc",
                        "title": "Descending Group",
                        "insert-controls": [
                            {
                                "order": "descending",
                                "include-controls": [
                                    {"with-ids": ["ac-10", "ac-02", "ac-05"]}
                                ],
                            }
                        ],
                    },
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        assert len(data["groups"]) == 2

        asc_ids = [c["id"] for c in data["groups"][0]["controls"]]
        assert asc_ids == ["ac-02", "ac-05", "ac-10"]


class TestProfileCustomGroupConflictDetection:
    """Tests for detecting orphaned custom group references across nested group hierarchies."""

    def test_detect_orphaned_ref_in_top_level_and_nested_groups(self):
        """Verify detect_modify_conflicts finds orphaned references in top-level and nested sub-groups."""
        profile = {
            "merge": {
                "custom": {
                    "groups": [
                        {
                            "id": "top-grp",
                            "title": "Top Group",
                            "insert-controls": [
                                {
                                    "include-controls": [
                                        {"with-ids": ["ac-1", "orphaned-top"]}
                                    ]
                                }
                            ],
                            "groups": [
                                {
                                    "id": "nested-child-grp",
                                    "title": "Nested Child",
                                    "insert-controls": [
                                        {
                                            "include-controls": [
                                                {"with-ids": ["ac-2", "orphaned-child"]}
                                            ]
                                        }
                                    ],
                                    "groups": [
                                        {
                                            "id": "nested-grandchild-grp",
                                            "title": "Nested Grandchild",
                                            "insert-controls": [
                                                {
                                                    "include-controls": [
                                                        {"with-ids": ["orphaned-grandchild"]}
                                                    ]
                                                }
                                            ],
                                        }
                                    ],
                                }
                            ],
                        }
                    ]
                }
            }
        }

        resolved_control_ids = {"ac-1", "ac-2"}
        resolved_param_ids = set()

        conflicts = detect_modify_conflicts(profile, resolved_control_ids, resolved_param_ids)

        assert conflicts["has_conflicts"] is True
        orphans = conflicts["orphaned_custom_refs"]
        assert len(orphans) == 3

        orphan_map = {(o["group-id"], o["control-id"]) for o in orphans}
        assert ("top-grp", "orphaned-top") in orphan_map
        assert ("nested-child-grp", "orphaned-child") in orphan_map
        assert ("nested-grandchild-grp", "orphaned-grandchild") in orphan_map

    def test_preview_endpoint_returns_custom_group_conflicts(self, client, isolated_data_dir):
        """Verify /api/resolve/profile/preview detects and returns orphaned custom refs."""
        cat_doc = CatalogFactory.build(controls=[{"id": "ac-1", "title": "Access Control"}])
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        preview_payload = {
            "profile": {
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "grp-1",
                                "title": "Group 1",
                                "groups": [
                                    {
                                        "id": "sub-grp-1",
                                        "title": "Subgroup 1",
                                        "insert-controls": [
                                            {
                                                "include-controls": [
                                                    {"with-ids": ["non-existent-ctrl"]}
                                                ]
                                            }
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                },
            }
        }

        res = client.post("/api/resolve/profile/preview", json=preview_payload)
        assert res.status_code == 200
        data = res.json()
        conflicts = data.get("conflicts", {})
        assert conflicts.get("has_conflicts") is True
        assert len(conflicts.get("orphaned_custom_refs", [])) == 1
        assert conflicts["orphaned_custom_refs"][0]["group-id"] == "sub-grp-1"
        assert conflicts["orphaned_custom_refs"][0]["control-id"] == "non-existent-ctrl"


class TestProfileCustomGroupPreprocessingAndValidation:
    """Tests for preprocessing, empty array sanitization, and NIST OSCAL v1.1.2 schema compliance."""

    @pytest.mark.asyncio
    async def test_preprocess_empty_custom_groups_normalizes_to_as_is(self):
        """Empty custom groups array must normalize to as-is: True without schema errors."""
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Empty Custom Groups Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": "../catalogs/dummy.json", "include-all": {}}],
                "merge": {"custom": {"groups": []}},
            }
        }
        cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
        assert "custom" not in cleaned["profile"]["merge"]
        assert cleaned["profile"]["merge"].get("as-is") is True

        # Must pass strict JSON schema validation
        await validate_document("profiles", cleaned, check_refs=False)

    @pytest.mark.asyncio
    async def test_preprocess_empty_nested_sub_arrays_stripped_cleanly(self):
        """
        Groups with empty sub-groups or empty insert-controls arrays must be stripped
        so that OSCAL minItems: 1 constraints are satisfied.
        """
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Custom Groups With Empty Arrays",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": "../catalogs/dummy.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "g-empty-subarrays",
                                "title": "Group With Empty Sub-arrays",
                                "groups": [],
                                "insert-controls": [],
                            },
                            {
                                "id": "g-empty-with-ids",
                                "title": "Group With Empty with-ids",
                                "insert-controls": [
                                    {"include-controls": [{"with-ids": []}]}
                                ],
                            },
                            {
                                "id": "g-valid",
                                "title": "Valid Group",
                                "insert-controls": [
                                    {
                                        "include-controls": [
                                            {"with-ids": ["ac-1"]}
                                        ]
                                    }
                                ],
                            },
                        ]
                    }
                },
            }
        }
        cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
        groups = cleaned["profile"]["merge"]["custom"]["groups"]
        assert len(groups) == 3

        # First group: groups and insert-controls removed
        assert "groups" not in groups[0]
        assert "insert-controls" not in groups[0]
        assert groups[0]["id"] == "g-empty-subarrays"

        # Second group: empty insert-controls structure removed
        assert "insert-controls" not in groups[1]
        assert groups[1]["id"] == "g-empty-with-ids"

        # Third group: retained
        assert "insert-controls" in groups[2]

        # Validates against official OSCAL profile schema
        await validate_document("profiles", cleaned, check_refs=False)

    def test_full_custom_group_crud_and_resolution_flow(self, client, isolated_data_dir):
        """End-to-end API lifecycle: POST profile -> GET profile -> GET resolve -> PUT profile -> GET resolve."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC-1"},
                {"id": "ac-2", "title": "AC-2"},
                {"id": "au-1", "title": "AU-1"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "g-initial",
                        "title": "Initial Group",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-1"]}]}
                        ],
                    }
                ]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]

        # 1. Create Profile
        res_post = client.post("/api/documents/profiles", json=prof_doc)
        assert res_post.status_code == 201

        # 2. Get Profile and verify merge structure
        res_get = client.get(f"/api/documents/profiles/{prof_uuid}")
        assert res_get.status_code == 200
        saved_merge = res_get.json()["profile"]["merge"]
        assert "custom" in saved_merge
        assert len(saved_merge["custom"]["groups"]) == 1

        # 3. Resolve Profile
        res_res1 = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_res1.status_code == 200
        data1 = res_res1.json()
        assert len(data1["groups"]) == 1
        assert data1["groups"][0]["controls"][0]["id"] == "ac-1"

        # 4. Update Profile with nested groups and modified assignment
        updated_doc = copy.deepcopy(prof_doc)
        updated_doc["profile"]["merge"]["custom"]["groups"] = [
            {
                "id": "g-parent",
                "title": "Parent Group",
                "groups": [
                    {
                        "id": "g-child",
                        "title": "Child Group",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-2", "au-1"]}]}
                        ],
                    }
                ],
            }
        ]
        res_post2 = client.post("/api/documents/profiles", json=updated_doc)
        assert res_post2.status_code == 200

        # 5. Re-resolve Profile and verify updated hierarchy
        res_res2 = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_res2.status_code == 200
        data2 = res_res2.json()
        assert len(data2["groups"]) == 1
        parent = data2["groups"][0]
        assert parent["id"] == "g-parent"
        assert len(parent["groups"]) == 1
        child = parent["groups"][0]
        assert child["id"] == "g-child"
        assert [c["id"] for c in child["controls"]] == ["ac-2", "au-1"]
